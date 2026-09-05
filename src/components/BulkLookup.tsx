import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Search, Trash2, ListChecks, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResultCard } from "@/components/ResultCard";
import {
  fetchAvailability,
  filterPlovdiv,
  enrichStoresWithStock,
  type ProductInfo,
  type Store,
} from "@/lib/praktiker";
import { loadPaints, findTintingInfo } from "@/lib/paints";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type BulkResult =
  | { code: string; status: "ok"; product: ProductInfo; plovdiv: Store[]; tinting: string | null; offerValidity: string | null }
  | { code: string; status: "error"; message: string };

const CODE_RE = /\d{6}/g;

export function extractCodes(text: string): string[] {
  const found = text.match(CODE_RE) ?? [];
  return Array.from(new Set(found));
}

async function fetchTinting(product: ProductInfo) {
  try {
    const params = new URLSearchParams({ code: product.code });
    if (product.url) params.set("url", product.url);
    const res = await fetch(`/api/public/tinting-info?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return { tinting: null, offerValidity: null };
    return (await res.json()) as { tinting: string | null; offerValidity: string | null };
  } catch {
    return { tinting: null, offerValidity: null };
  }
}

async function readFileCodes(file: File, onProgress: (msg: string) => void): Promise<string> {
  const name = file.name.toLowerCase();

  if (/\.(xlsx|xls|xlsm|csv|ods)$/.test(name)) {
    onProgress(`Обработка на ${file.name}...`);
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
  }

  onProgress(`Обработка на ${file.name}...`);
  return file.text();
}

export function BulkLookup({ open, onOpenChange }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const savedInput = localStorage.getItem("praktiker.bulk.input");
      if (savedInput) setInput(savedInput);
      const savedResults = localStorage.getItem("praktiker.bulk.results");
      if (savedResults) setResults(JSON.parse(savedResults));
      const savedChecked = localStorage.getItem("praktiker.bulk.checked");
      if (savedChecked) setCheckedCodes(new Set(JSON.parse(savedChecked)));
    } catch { /* игнорира повредени данни */ }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("praktiker.bulk.input", input);
  }, [input]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (results) localStorage.setItem("praktiker.bulk.results", JSON.stringify(results));
    else localStorage.removeItem("praktiker.bulk.results");
  }, [results]);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("praktiker.bulk.checked", JSON.stringify(Array.from(checkedCodes)));
  }, [checkedCodes]);

  const toggleChecked = (code: string) =>
    setCheckedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const removeResult = (code: string) => {
    setResults((prev) => (prev ? prev.filter((r) => r.code !== code) : prev));
    setCheckedCodes((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const paints = loadPaints();

  const run = async (codes: string[]) => {
    if (!codes.length) {
      setResults([]);
      return;
    }
    setLoading(true);
    setResults([]);
    const collected: BulkResult[] = [];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      setProgress(`Проверка ${i + 1} от ${codes.length} — ${code}`);
      try {
        const { product, stores } = await fetchAvailability(code);
        const plovdiv = await enrichStoresWithStock(product.code, filterPlovdiv(stores));
        const t = await fetchTinting(product);
        collected.push({
          code,
          status: "ok",
          product,
          plovdiv,
          tinting: t.tinting ?? findTintingInfo(product.code, paints) ?? null,
          offerValidity: t.offerValidity ?? null,
        });
      } catch (e) {
        collected.push({ code, status: "error", message: e instanceof Error ? e.message : "Грешка" });
      }
      setResults([...collected]);
    }
    setProgress(null);
    setLoading(false);
  };

  const handleSearch = () => run(extractCodes(input));

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    try {
      let text = "";
      for (const file of Array.from(files)) {
        try {
          text += "\n" + (await readFileCodes(file, setProgress));
        } catch {
          /* пропускаме файл, който не може да се прочете */
        }
      }
      const codes = extractCodes(text);
      const merged = Array.from(new Set([...extractCodes(input), ...codes]));
      setInput(merged.join("\n"));
      setProgress(null);
      setLoading(false);
      await run(merged);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const codeCount = extractCodes(input).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-blue-600" />
            Групова проверка
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <textarea
              id="bulk-codes"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Въведи 6-цифрени SAP кодове"
              className="flex min-h-[140px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground">Разпознати кодове: {codeCount}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || codeCount === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Търси
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              style={{ borderColor: "var(--contour-green)" }}
            >
              <Upload className="size-4" />
              Файл
            </button>
            <button
              type="button"
              onClick={() => {
                setInput("");
                setResults(null);
                setCheckedCodes(new Set());
              }}
              disabled={loading}
              aria-label="Изчисти"
              className="inline-flex items-center justify-center rounded-xl border bg-card px-3 py-2.5 text-foreground hover:bg-muted disabled:opacity-50"
              style={{ borderColor: "var(--contour-green)" }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-xs text-muted-foreground">
            Поддържани файлове: документи (Excel/CSV таблици, текстови файлове).
          </p>

          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {progress}
            </div>
          )}

          {results && results.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">Няма намерени кодове.</p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-4 pb-6">
              {results.map((r) =>
                r.status === "ok" ? (
                <ResultCard
                  key={r.code}
                  product={r.product}
                  plovdivStores={r.plovdiv}
                  tintingInfo={r.tinting ?? undefined}
                  offerValidity={r.offerValidity}
                  checked={checkedCodes.has(r.code)}
                  onToggleChecked={() => toggleChecked(r.code)}
                  onRemove={() => removeResult(r.code)}
                  variant="bulk"
                />
                ) : (
                  <div
                    key={r.code}
                    className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm flex items-center gap-2"
                  >
                    <span className="flex-1">
                      {r.code}: {r.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeResult(r.code)}
                      aria-label="Премахни от резултатите"
                      title="Премахни от резултатите"
                      className="inline-flex items-center justify-center size-6 rounded-md hover:bg-destructive/20 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
