import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Palette, RefreshCw, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadPaints,
  loadUpdatedAt,
  refreshPaints,
  PAINTS_SOURCE_URL,
  type Paint,
} from "@/lib/paints";

export const Route = createFileRoute("/tonirane")({
  component: ToniranePage,
  head: () => ({
    meta: [
      { title: "Безплатно тониране на бои — Praktiker Plovdiv" },
      {
        name: "description",
        content:
          "Списък на бои с безплатно тониране от текущата брошура на Praktiker.",
      },
      { property: "og:title", content: "Безплатно тониране на бои — Praktiker Plovdiv" },
      { property: "og:description", content: "Бои с безплатно тониране от текущата брошура на Praktiker — провери наличност в Пловдив." },
      { property: "og:url", content: "https://praktiker-plovdiv.lovable.app/tonirane" },
      { name: "twitter:title", content: "Безплатно тониране на бои — Praktiker Plovdiv" },
      { name: "twitter:description", content: "Бои с безплатно тониране от текущата брошура на Praktiker — провери наличност в Пловдив." },
    ],
    links: [
      { rel: "canonical", href: "https://praktiker-plovdiv.lovable.app/tonirane" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Безплатно тониране на бои",
          description: "Списък на бои с безплатно тониране от текущата брошура на Praktiker.",
          url: "https://praktiker-plovdiv.lovable.app/tonirane",
          inLanguage: "bg",
          isPartOf: {
            "@type": "WebSite",
            name: "Praktiker Plovdiv",
            url: "https://praktiker-plovdiv.lovable.app",
          },
        }),
      },
    ],
  }),
});

function ToniranePage() {
  const navigate = useNavigate();
  const [paints, setPaints] = useState<Paint[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPaints(loadPaints());
    setUpdatedAt(loadUpdatedAt());
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const next = await refreshPaints();
      setPaints(next.paints);
      setUpdatedAt(next.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при опресняване.");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePick = (p: Paint) => {
    const latin = (p.name.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []).join(" ").trim();
    navigate({ to: "/", search: { q: latin || p.name } as never });
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <header
        className="px-5 pt-10 pb-8 text-primary-foreground"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div className="max-w-md mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm font-medium opacity-90 hover:opacity-100"
          >
            <ArrowLeft className="size-4" />
            Назад
          </Link>
          <div className="mt-3 flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Palette className="size-5" />
              Безплатно тониране
            </h1>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Опресни"
              title="Опресни"
              className="inline-flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 size-8 disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <p className="mt-1 text-sm opacity-90">
            Бои от текущата брошура на Praktiker с безплатно тониране.
          </p>
        </div>
      </header>

      <section className="px-5 -mt-4 max-w-md mx-auto">
        {error && (
          <div className="mb-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 text-sm">
            {error}
          </div>
        )}
        <ul className="space-y-3">
          {paints.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                onClick={() => handlePick(p)}
                className="w-full text-left rounded-2xl bg-card border border-border p-4 shadow-[var(--shadow-soft)] hover:bg-muted transition-colors"
              >
                <h2 className="font-semibold text-foreground text-sm leading-snug">
                  {p.name}
                </h2>
                <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
                  {p.description}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          <a
            href={PAINTS_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            Източник: брошура Praktiker
            <ExternalLink className="size-3" />
          </a>
        </div>
      </section>
    </main>
  );
}
