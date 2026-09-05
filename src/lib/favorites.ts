export type FavoriteRecord = {
  code: string;
  name: string;
  imageUrl?: string;
  url?: string;
  brand?: string;
  ean?: string;
  note?: string;
  addedAt: number;
};

const KEY = "praktiker.favorites.v1";

export function loadFavorites(): FavoriteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteRecord[];
  } catch {
    return [];
  }
}

function save(list: FavoriteRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function isFavorite(code: string): boolean {
  return loadFavorites().some((f) => f.code === code);
}

export function addFavorite(rec: Omit<FavoriteRecord, "addedAt">) {
  if (typeof window === "undefined") return;
  const list = loadFavorites().filter((f) => f.code !== rec.code);
  list.unshift({ ...rec, addedAt: Date.now() });
  save(list);
}

export function removeFavorite(code: string) {
  if (typeof window === "undefined") return;
  save(loadFavorites().filter((f) => f.code !== code));
}

export function updateFavoriteNote(code: string, note: string) {
  if (typeof window === "undefined") return;
  const list = loadFavorites().map((f) => (f.code === code ? { ...f, note } : f));
  save(list);
}

export function toggleFavorite(rec: Omit<FavoriteRecord, "addedAt">): boolean {
  if (isFavorite(rec.code)) {
    removeFavorite(rec.code);
    return false;
  }
  addFavorite(rec);
  return true;
}