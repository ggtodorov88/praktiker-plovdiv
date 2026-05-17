import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, Image as ImageIcon, X, Sun, Moon } from "lucide-react";
import { fetchAvailability, filterPlovdiv, enrichStoresWithStock, searchProducts, type ProductInfo, type Store } from "@/lib/praktiker";
import { loadHistory, saveCheck, clearHistory, removeFromHistory, updateNote, type CheckRecord } from "@/lib/storage";
import { loadPaints, findTintingInfo } from "@/lib/paints";
import { getTintingInfo } from "@/lib/tinting.functions";

import { ResultCard } from "@/components/ResultCard";
import { HistoryList } from "@/components/HistoryList";
import { ScanButton } from "@/components/ScanButton";
import praktikerLogo from "@/assets/praktiker-logo.svg";

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Praktiker Plovdiv — Проверка на наличност и баркод" },
      {
        name: "description",
        content: "Провери дали продукт от praktiker.bg е наличен в магазините в Пловдив по 6-цифрен код.",
      },
      { property: "og:title", content: "Praktiker Plovdiv — Проверка на наличност" },
      { property: "og:description", content: "Провери наличност на продукти от praktiker.bg в магазините в Пловдив по код или баркод." },
      { property: "og:url", content: "https://praktiker-plovdiv.lovable.app/" },
      { name: "twitter:title", content: "Praktiker Plovdiv — Проверка на наличност" },
      { name: "twitter:description", content: "Провери наличност на продукти от praktiker.bg в магазините в Пловдив по код или баркод." },
    ],
    links: [
      { rel: "canonical", href: "https://praktiker-plovdiv.lovable.app/" },
    ],
  }),
});

function Index() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ product: ProductInfo; plovdiv: Store[] } | null>(null);
  const [history, setHistory] = useState<CheckRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProductInfo[] | null>(null);
  const [dynamicTinting, setDynamicTinting] = useState<string | null>(null);
  const [offerValidity, setOfferValidity] = useState<string | null>(null);

  const searchSeq = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = (localStorage.getItem("praktiker.theme") as "light" | "dark" | null) ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("praktiker.theme", next);
    }
  };

  const runSearch = async (q: string) => {
    const query = q.trim();
    if (!query) {
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const items = await searchProducts(query);
      if (seq !== searchSeq.current) return;
      setSearchResults(items);
    } catch (e) {
      if (seq !== searchSeq.current) return;
      setSearchError(e instanceof Error ? e.message : "Грешка при търсене.");
      setSearchResults(null);
    } finally {
      if (seq === searchSeq.current) setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      searchSeq.current++;
      setSearchResults(null);
      setSearchError(null);
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const pickProduct = (p: ProductInfo) => {
    setCode(p.code);
    setSearchResults(null);
    setSearchQuery("");
    check(p.code);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => { setHistory(loadHistory()); }, []);

  // Поддръжка на отваряне с външни баркод скенери чрез ?code=XXXX и автоматично пълнене с ?q=
  const searchParams = Route.useSearch();
  useEffect(() => {
    const c = (searchParams.code ?? "").replace(/\D/g, "");
    if (c.length >= 6) {
      setCode(c);
      check(c);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
      return;
    }
    const q = (searchParams.q ?? "").trim();
    if (q) {
      setSearchQuery(q);
      runSearch(q);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.code, searchParams.q]);

  const check = async (c: string) => {
    if (c.length < 6) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDynamicTinting(null);
    setOfferValidity(null);
    try {
      const { product, stores } = await fetchAvailability(c);
      const plovdivBase = filterPlovdiv(stores);
      const plovdiv = await enrichStoresWithStock(product.code, plovdivBase);
      setResult({ product, plovdiv });
      const totalPlovdiv = plovdiv.reduce((sum, s) => sum + (s.stockLevel ?? 0), 0);
      saveCheck({
        code: product.code,
        name: product.name,
        imageUrl: product.imageUrl,
        url: product.url,
        inStock: plovdiv.length > 0,
        storeNames: plovdiv.map((s) => s.displayName),
        plovdivStock: totalPlovdiv,
        checkedAt: Date.now(),
        ean: product.ean,
        brand: product.brand,
      });
      setHistory(loadHistory());
      // Извличане на информация за безплатно тониране от продуктовата страница
      getTintingInfo({ data: { code: product.code, url: product.url } })
        .then((r) => {
          setDynamicTinting(r?.tinting ?? null);
          setOfferValidity(r?.offerValidity ?? null);
        })
        .catch(() => {
          setDynamicTinting(null);
          setOfferValidity(null);
        });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Възникна грешка.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecheck = (c: string) => {
    setCode(c);
    check(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <header
        className="px-5 pt-10 pb-8 text-primary-foreground"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          <img
            src={praktikerLogo}
            alt="Praktiker Plovdiv Logo"
            className="h-7 w-auto"
          />
          <h1 className="sr-only">Проверка на наличност в Praktiker Пловдив</h1>
          <div className="mt-1 text-sm font-medium opacity-90">
            гр. Пловдив, бул. Кукленско шосе 9
          </div>
        </div>
      </header>

      <section className="px-5 -mt-6">
        <div className="max-w-md mx-auto rounded-2xl bg-card border border-border p-5 shadow-[var(--shadow-soft)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchQuery.trim();
              if (!q) return;
              searchInputRef.current?.blur();
              if (/^\d{6,}$/.test(q)) {
                setCode(q);
                setSearchResults(null);
                check(q);
              } else {
                runSearch(q);
              }
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <label htmlFor="main-search" className="sr-only">
                  Търсене по код или име на продукт
                </label>
                <input
                  id="main-search"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Код или име на продукт"
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {(searchQuery || searchResults || searchError || result) && (
                  <button
                    type="button"
                    onClick={() => {
                      searchSeq.current++;
                      setSearchQuery("");
                      setSearchResults(null);
                      setSearchError(null);
                      setSearchLoading(false);
                      setCode("");
                      setResult(null);
                      setError(null);
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Изчисти"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <X className="size-6" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || searchLoading || !searchQuery.trim()}
                aria-label="Търси"
                className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-3 py-3 hover:opacity-90 disabled:opacity-50"
              >
                {searchLoading ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
              </button>
            </div>
            <ScanButton
              disabled={loading || searchLoading}
              className="w-full"
              label="Сканирай баркод"
              onResult={(c: string) => {
                setSearchQuery("");
                setSearchResults(null);
                setCode(c);
                check(c);
              }}
            />
          </form>

          {searchError && (
            <div className="mt-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 text-sm">
              {searchError}
            </div>
          )}

          {searchResults && searchResults.length === 0 && !searchLoading && (
            <p className="mt-3 text-sm text-muted-foreground">Няма намерени продукти.</p>
          )}

          {searchResults && searchResults.length > 0 && (
            <ul className="mt-4 space-y-2">
              {searchResults.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-2 text-left hover:bg-muted transition-colors"
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="size-14 rounded-lg object-contain bg-white border border-border" />
                    ) : (
                      <div className="size-14 rounded-lg bg-muted flex items-center justify-center">
                        <ImageIcon className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.code}{p.price ? ` · ${p.price}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="max-w-md mx-auto mt-3 flex justify-center">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Смяна на тема"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card p-2 text-foreground hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </section>

      <section className="px-5 mt-6 max-w-md mx-auto space-y-6">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <ResultCard
            product={result.product}
            plovdivStores={result.plovdiv}
            tintingInfo={dynamicTinting ?? findTintingInfo(result.product.code, loadPaints())}
            offerValidity={offerValidity}
          />
        )}

        <HistoryList
          items={history}
          onRecheck={handleRecheck}
          onRemove={(c) => { removeFromHistory(c); setHistory(loadHistory()); }}
          onClear={() => { clearHistory(); setHistory([]); }}
          onNoteChange={(id, note) => {
            updateNote(id, note);
            setHistory((prev) => prev.map((r) => ((r.id ?? `${r.code}-${r.checkedAt}`) === id ? { ...r, note } : r)));
          }}
        />
      </section>
    </main>
  );
}
