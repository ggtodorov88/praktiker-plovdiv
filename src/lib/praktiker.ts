const API = "https://api.praktiker.bg/videoluxcommercewebservices/v2/praktiker/products";

export type Store = {
  name: string;
  displayName: string;
  town: string;
  address: string;
  phone?: string;
  hoursWeekdays?: string;
  hoursWeekend?: string;
  stockLevel?: number;
  stockStatus?: string;
};

export type ProductInfo = {
  code: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  price?: string;
  url?: string;
  totalStock?: number;
  stockStatus?: string;
  ean?: string;
  warrantyMonths?: number;
};

function extractWarrantyMonths(classifications: unknown): number | undefined {
  if (!Array.isArray(classifications)) return undefined;
  for (const c of classifications) {
    const features = (c as { features?: { name?: string; featureValues?: { value?: string }[] }[] })?.features;
    if (!Array.isArray(features)) continue;
    for (const f of features) {
      const name = (f.name || "").toUpperCase();
      if (name.includes("ГАРАНЦИЯ")) {
        const val = f.featureValues?.[0]?.value || "";
        const m = val.match(/(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
    }
  }
  return undefined;
}

export type AvailabilityResult = {
  product: ProductInfo;
  stores: Store[];
};

type RawProduct = {
  code: string;
  name: string;
  brand?: string;
  ean?: string;
  images?: { format: string; url: string }[];
  price?: { formattedValue?: string };
  url?: string;
  stock?: { stockLevel?: number; stockLevelStatus?: string };
};

function mapProduct(p: RawProduct): ProductInfo {
  const img = (p.images ?? []).find((i) => i.format === "videoluxProduct" || i.format === "videoluxGrid");
  return {
    code: p.code,
    name: p.name,
    brand: p.brand,
    imageUrl: img?.url ? `${IMAGE_BASE}${img.url}` : undefined,
    price: p.price?.formattedValue,
    url: p.url ? `https://praktiker.bg/bg${p.url}` : undefined,
    totalStock: p.stock?.stockLevel,
    stockStatus: p.stock?.stockLevelStatus,
    ean: p.ean,
  };
}

export async function searchProducts(query: string, pageSize = 100): Promise<ProductInfo[]> {
  const fetchPage = async (page: number) => {
    const url = `${API}/search?query=${encodeURIComponent(query)}&fields=FULL&lang=bg&curr=EUR&pageSize=${pageSize}&currentPage=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Грешка ${res.status} при търсене.`);
    return res.json() as Promise<{
      products?: RawProduct[];
      pagination?: { totalPages?: number; currentPage?: number; totalResults?: number };
    }>;
  };

  const first = await fetchPage(0);
  const all: RawProduct[] = [...(first.products ?? [])];
  const totalPages = first.pagination?.totalPages ?? 1;

  if (totalPages > 1) {
    const pages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 1))
    );
    for (const pg of pages) all.push(...(pg.products ?? []));
  }

  return all.map(mapProduct);
}

const IMAGE_BASE = "https://api.praktiker.bg";

async function resolveCodeFromBarcode(barcode: string): Promise<string | null> {
  try {
    const url = `${API}/search?query=${encodeURIComponent(barcode)}&fields=FULL&lang=bg&curr=EUR&pageSize=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.products?.[0];
    return first?.code ?? null;
  } catch {
    return null;
  }
}

export async function fetchProduct(code: string): Promise<ProductInfo> {
  const tryFetch = async (c: string) => {
    const url = `${API}/${encodeURIComponent(c)}?fields=DEFAULT,images(FULL),brand,ean,classifications(FULL)&lang=bg&curr=EUR`;
    return fetch(url);
  };

  let actualCode = code;
  let res = await tryFetch(actualCode);

  // If not found and the input looks like a barcode (8+ digits), try resolving via search.
  if ((res.status === 404 || res.status === 400) && /^\d{8,}$/.test(code)) {
    const resolved = await resolveCodeFromBarcode(code);
    if (resolved && resolved !== code) {
      actualCode = resolved;
      res = await tryFetch(actualCode);
    }
  }

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) throw new Error(`Продуктът с код ${code} не е намерен.`);
    throw new Error(`Грешка ${res.status} при зареждане на продукта.`);
  }
  const data = await res.json();
  const img = (data.images ?? []).find((i: { format: string }) => i.format === "videoluxProduct" || i.format === "videoluxGrid");
  return {
    code: actualCode,
    name: data.name ?? `Продукт ${actualCode}`,
    brand: data.brand,
    imageUrl: img?.url ? `${IMAGE_BASE}${img.url}` : undefined,
    price: data.price?.formattedValue,
    url: data.url ? `https://praktiker.bg/bg${data.url}` : undefined,
    totalStock: typeof data.stock?.stockLevel === "number" ? data.stock.stockLevel : undefined,
    stockStatus: data.stock?.stockLevelStatus,
    ean: data.ean,
    warrantyMonths: extractWarrantyMonths(data.classifications),
  };
}

export function clearAvailabilityCache(_code?: string) {
  // no-op: caching disabled
}

export async function fetchAvailability(code: string, _opts?: { force?: boolean }): Promise<AvailabilityResult> {
  const product = await fetchProduct(code);
  const url = `${API}/${encodeURIComponent(product.code)}/availability?lang=bg&curr=EUR`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Грешка ${res.status} при проверка на наличност.`);
  const data = await res.json();
  const pos = data.availability?.pointsOfService ?? [];
  const stores: Store[] = pos.map((s: {
    displayName: string;
    name: string;
    address: { town: string; formattedAddress: string; phone?: string };
    weekDaysOpeningHours?: string;
    weekendOpeningHours?: string;
  }) => ({
    name: s.name,
    displayName: s.displayName,
    town: s.address?.town ?? "",
    address: s.address?.formattedAddress ?? "",
    phone: s.address?.phone,
    hoursWeekdays: s.weekDaysOpeningHours,
    hoursWeekend: s.weekendOpeningHours,
  }));
  return { product, stores };
}

export function filterPlovdiv(stores: Store[]): Store[] {
  return stores.filter((s) => s.town.trim().toLowerCase() === "пловдив");
}

export async function fetchStoreStock(productCode: string, storeId: string): Promise<{ stockLevel: number; stockLevelStatus?: string } | null> {
  try {
    const url = `${API}/${encodeURIComponent(productCode)}/stock/${encodeURIComponent(storeId)}?lang=bg&curr=EUR`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return { stockLevel: data.stockLevel ?? 0, stockLevelStatus: data.stockLevelStatus };
  } catch {
    return null;
  }
}

export async function enrichStoresWithStock(productCode: string, stores: Store[]): Promise<Store[]> {
  const results = await Promise.all(
    stores.map(async (s) => {
      const stock = await fetchStoreStock(productCode, s.name);
      return { ...s, stockLevel: stock?.stockLevel, stockStatus: stock?.stockLevelStatus };
    })
  );
  return results;
}
