import { useEffect, useState } from "react";
import { X, Loader2, ExternalLink } from "lucide-react";

const SHEET_ID = "1RedyF1AWjj0UPn2qK2Z4MxghBQHty4ZSM3AEPDQXTSk";

type Match = {
  regal: string | null;
  palet: string | null;
  rowValues: string[];
};

type Props = {
  code: string | null;
  onClose: () => void;
};

// Minimal CSV parser supporting quoted fields and "" escaping.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        cur = "";
        rows.push(row);
        row = [];
      } else cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function cleanRegal(s: string): string {
  // "РЕГАЛ  \" H \"" → "H"
  const m = s.match(/"([^"]+)"/);
  if (m) return m[1].trim();
  return s.replace(/^РЕГАЛ\s*/i, "").replace(/"/g, "").trim();
}

function cleanPalet(s: string): string {
  return s.replace(/^палет\s*/i, "").trim();
}

export function SheetLookupDialog({ code, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    setMatches([]);

    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const needle = code.toLowerCase().trim();

        let currentRegal: string | null = null;
        let currentPalet: string | null = null;
        const result: Match[] = [];

        for (const r of rows) {
          const colA = (r[0] ?? "").trim();
          const colB = (r[1] ?? "").trim();

          // Header row defines a new section: col A holds РЕГАЛ, col B holds Палет.
          const isRegalHeader = /регал/i.test(colA);
          const isPaletInB = /^палет\s*\d+/i.test(colB);
          if (isRegalHeader || isPaletInB) {
            if (isRegalHeader) currentRegal = cleanRegal(colA);
            if (isPaletInB) currentPalet = cleanPalet(colB);
            continue;
          }
          // Stand-alone palet row (col B only, no regal header): update palet, keep regal.
          if (!colA && /^палет\s*\d+/i.test(colB)) {
            currentPalet = cleanPalet(colB);
            continue;
          }

          // Match the code anywhere in the row.
          if (r.some((v) => v && v.toLowerCase().includes(needle))) {
            result.push({
              regal: currentRegal,
              palet: currentPalet,
              rowValues: r,
            });
          }
        }
        setMatches(result);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Грешка при зареждане"))
      .finally(() => setLoading(false));
  }, [code]);

  if (!code) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Локация в склада</h2>
            <p className="text-xs text-muted-foreground">Код: {code}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              title="Отвори в Google Sheets"
              aria-label="Отвори таблицата на склада в Google Sheets"
            >
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Затвори"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
              <Loader2 className="size-5 animate-spin" /> Зареждане...
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {!loading && !error && matches.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Няма съвпадения за този код.</p>
          )}
          {!loading && !error && matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((m, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-primary/10 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Регал</p>
                      <p className="text-base font-bold text-foreground">{m.regal ?? "—"}</p>
                    </div>
                    <div className="rounded-lg bg-accent/20 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Палет</p>
                      <p className="text-base font-bold text-foreground">{m.palet ?? "—"}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {m.rowValues.filter(Boolean).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
