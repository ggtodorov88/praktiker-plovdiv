import { useEffect, useState } from "react";
import { X, ExternalLink, Star, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { FavoriteRecord } from "@/lib/favorites";
import { updateFavoriteNote } from "@/lib/favorites";
import { fetchAvailability, filterPlovdiv, enrichStoresWithStock } from "@/lib/praktiker";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FavoriteRecord[];
  onPick: (code: string) => void;
  onRemove: (code: string) => void;
};

type StockState = { loading: boolean; total?: number; error?: boolean };

export function FavoritesList({ open, onOpenChange, items, onPick, onRemove }: Props) {
  const [stock, setStock] = useState<Record<string, StockState>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setNotes(Object.fromEntries(items.map((f) => [f.code, f.note ?? ""])));
  }, [items]);

  const refreshStock = async () => {
    if (items.length === 0) return;
    setStock(Object.fromEntries(items.map((f) => [f.code, { loading: true }])));
    await Promise.all(
      items.map(async (f) => {
        try {
          const { product, stores } = await fetchAvailability(f.code);
          const plovdivBase = filterPlovdiv(stores);
          const plovdiv = await enrichStoresWithStock(product.code, plovdivBase);
          const total = plovdiv.reduce((sum, s) => sum + (s.stockLevel ?? 0), 0);
          setStock((prev) => ({ ...prev, [f.code]: { loading: false, total } }));
        } catch {
          setStock((prev) => ({ ...prev, [f.code]: { loading: false, error: true } }));
        }
      })
    );
  };

  useEffect(() => {
    if (open) refreshStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleNoteChange = (code: string, value: string) => {
    setNotes((prev) => ({ ...prev, [code]: value }));
    updateFavoriteNote(code, value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 fill-current text-blue-600" />
            Любими
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center mt-8">
              Все още нямате любими продукти. Натиснете звездата на резултата за да добавите.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((f) => {
                const s = stock[f.code];
                return (
                <li
                  key={f.code}
                  className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-primary/40 hover:shadow-md animate-fade-in"
                >
                  <div className="shrink-0 flex flex-col items-center gap-0.5 w-14">
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative"
                        aria-label={`Отвори ${f.name} в praktiker.bg`}
                        title="Отвори в praktiker.bg"
                      >
                        {f.imageUrl ? (
                          <img src={f.imageUrl} alt="" className="size-12 rounded-md object-contain bg-muted" loading="lazy" />
                        ) : (
                          <div className="size-12 rounded-md bg-muted" />
                        )}
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card">
                          <ExternalLink className="size-3" />
                        </span>
                      </a>
                    ) : f.imageUrl ? (
                      <img src={f.imageUrl} alt="" className="size-12 rounded-md object-contain bg-muted" loading="lazy" />
                    ) : (
                      <div className="size-12 rounded-md bg-muted" />
                    )}
                    {f.brand && (
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium text-center break-words leading-tight w-full">
                        {f.brand}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(f.code);
                        onOpenChange(false);
                      }}
                      className="text-left"
                    >
                      <p className="font-medium text-sm text-foreground break-words">{f.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>
                          SAP {f.code}
                          {f.ean && <span> · EAN ····{f.ean.slice(-4)}</span>}
                        </span>
                        {s?.loading ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                          </span>
                        ) : s?.error ? (
                          <span className="text-destructive">грешка</span>
                        ) : typeof s?.total === "number" ? (
                          s.total > 0 ? (
                            <span className="inline-flex items-center gap-1 text-success">
                              <CheckCircle2 className="size-3.5" />
                              {s.total}
                            </span>
                          ) : (
                            <XCircle className="size-3.5 text-muted-foreground" />
                          )
                        ) : null}
                      </p>
                    </button>
                    <input
                      type="text"
                      value={notes[f.code] ?? ""}
                      onChange={(e) => handleNoteChange(f.code, e.target.value)}
                      aria-label={`Бележка за ${f.name}`}
                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <button
                    onClick={() => onRemove(f.code)}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors duration-150 shrink-0"
                    aria-label="Премахни от любими"
                  >
                    <X className="size-4" />
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}