import { useState } from "react";
import type { ProductInfo, Store } from "@/lib/praktiker";
import { CheckCircle2, XCircle, Table2, ExternalLink } from "lucide-react";
import { SheetLookupDialog } from "./SheetLookupDialog";

type Props = {
  product: ProductInfo;
  plovdivStores: Store[];
  tintingInfo?: string;
  offerValidity?: string | null;
};

function stockBadgeClass(level: number | undefined) {
  if (level === undefined) return "bg-muted text-muted-foreground";
  if (level === 0) return "bg-muted text-muted-foreground";
  if (level <= 3) return "bg-accent text-accent-foreground";
  return "bg-success/15 text-success";
}

export function ResultCard({ product, plovdivStores, tintingInfo, offerValidity }: Props) {
  const totalPlovdiv = plovdivStores.reduce((sum, s) => sum + (s.stockLevel ?? 0), 0);
  const inStock = totalPlovdiv > 0 || plovdivStores.length > 0;
  const [sheetOpen, setSheetOpen] = useState<string | null>(null);

  return (
    <div className="rounded-2xl bg-card shadow-[var(--shadow-card)] overflow-hidden border border-border">
      <div
        className={`px-5 py-4 flex items-center gap-3 ${
          totalPlovdiv > 0 ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {inStock ? <CheckCircle2 className="size-6 shrink-0" /> : <XCircle className="size-6 shrink-0" />}
        <div className="flex-1">
          <p className="font-semibold text-base leading-tight">
            {totalPlovdiv > 0
              ? `Налични: ${totalPlovdiv}`
              : plovdivStores.length > 0
                ? "Налично, без точна бройка"
                : "Не е налично"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(product.code)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
          title={`Търси код ${product.code} в таблицата`}
        >
          <Table2 className="size-3" />
          Склад
        </button>
      </div>
      {tintingInfo && (
        <div className="px-5 py-3 bg-success/15 text-success border-b border-success/20">
          <p className="text-xs font-medium leading-snug">{tintingInfo}</p>
        </div>
      )}
      <SheetLookupDialog code={sheetOpen} onClose={() => setSheetOpen(null)} />

      <div className="p-5 flex gap-4">
        <div className="shrink-0 flex flex-col items-center gap-1 w-20">
          {product.imageUrl ? (
            product.url ? (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group"
                title="Отвори в praktiker.bg"
                aria-label="Отвори продукта в praktiker.bg"
              >
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="size-20 rounded-lg object-contain bg-muted"
                  loading="lazy"
                />
                <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card">
                  <ExternalLink className="size-3.5" />
                </span>
              </a>
            ) : (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="size-20 rounded-lg object-contain bg-muted"
                loading="lazy"
              />
            )
          ) : (
            <div className="size-20 rounded-lg bg-muted" />
          )}
          {product.brand && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium text-center break-words w-full">{product.brand}</p>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground text-base leading-snug line-clamp-2">{product.name}</h2>
          {offerValidity && (
            <p className="mt-1 text-xs font-medium text-success">{offerValidity}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            {product.price && <span className="text-sm font-semibold text-foreground">{product.price}</span>}
            <span className="text-xs text-muted-foreground">код {product.code}</span>
            {product.ean && <span className="text-xs text-muted-foreground">EAN {product.ean}</span>}
          </div>
          {product.warrantyMonths !== undefined && (
            <p className="mt-1 text-xs font-medium text-foreground/80">
              Гаранция {product.warrantyMonths} месеца
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
