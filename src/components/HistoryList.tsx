import { useState } from "react";
import type { CheckRecord } from "@/lib/storage";
import { CheckCircle2, XCircle, X, Table2, ExternalLink } from "lucide-react";
import { SheetLookupDialog } from "./SheetLookupDialog";

type Props = {
  items: CheckRecord[];
  onRecheck: (code: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onNoteChange: (id: string, note: string) => void;
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "сега";
  if (s < 3600) return `преди ${Math.floor(s / 60)} мин`;
  if (s < 86400) return `преди ${Math.floor(s / 3600)} ч`;
  return `преди ${Math.floor(s / 86400)} дни`;
}

export function HistoryList({ items, onRecheck, onRemove, onClear, onNoteChange }: Props) {
  const [sheetOpen, setSheetOpen] = useState<string | null>(null);
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Скорошни проверки
        </h2>
        <button
          onClick={onClear}
          className="text-xs font-medium text-muted-foreground hover:text-destructive"
        >
          Изчисти
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id ?? `${it.code}-${it.checkedAt}`}
            className="flex items-center gap-3 rounded-xl bg-card border border-border p-3 shadow-[var(--shadow-card)]"
          >
            <div className="shrink-0 flex flex-col items-center gap-0.5 w-14">
              {it.url ? (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative"
                  aria-label={`Отвори ${it.name} в praktiker.bg`}
                  title="Отвори в praktiker.bg"
                >
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt="" className="size-12 rounded-md object-contain bg-muted" loading="lazy" />
                  ) : (
                    <div className="size-12 rounded-md bg-muted" />
                  )}
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card">
                    <ExternalLink className="size-3" />
                  </span>
                </a>
              ) : it.imageUrl ? (
                <img src={it.imageUrl} alt="" className="size-12 rounded-md object-contain bg-muted" loading="lazy" />
              ) : (
                <div className="size-12 rounded-md bg-muted" />
              )}
              {it.brand && (
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium text-center break-words leading-tight w-full">{it.brand}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRecheck(it.code)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex items-center gap-1.5">
                {it.inStock ? (
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                ) : (
                  <XCircle className="size-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs text-muted-foreground">
                  {it.inStock
                    ? `${it.plovdivStock ?? 0}`
                    : "няма"} · {timeAgo(it.checkedAt)}
                </span>
              </div>
              <p className="font-medium text-sm text-foreground break-words">{it.name}</p>
              <p className="text-xs text-muted-foreground">
                код {it.code}
                {it.ean && <span> · EAN ····{it.ean.slice(-4)}</span>}
              </p>
            </button>
            <input
              type="text"
              value={it.note ?? ""}
              onChange={(e) => onNoteChange(it.id ?? `${it.code}-${it.checkedAt}`, e.target.value)}
              aria-label="Бележка"
              className="size-12 rounded-md border border-border bg-background text-center text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0"
            />
            <button
              type="button"
              onClick={() => setSheetOpen(it.code)}
              className="inline-flex items-center justify-center size-9 rounded-lg bg-muted hover:bg-muted/70 text-foreground shrink-0"
              title={`Търси код ${it.code} в склада`}
              aria-label="Склад"
            >
              <Table2 className="size-4" />
            </button>
            <button
              onClick={() => onRemove(it.id ?? `${it.code}-${it.checkedAt}`)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label="Премахни"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <SheetLookupDialog code={sheetOpen} onClose={() => setSheetOpen(null)} />
    </div>
  );
}
