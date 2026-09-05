import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOSTS = ["praktiker.bg", "www.praktiker.bg"];
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function decodeHtml(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(s: string) {
  return decodeHtml(s.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .replace(/\s*Предложението\s+НЕ\s+Е\s+валидно при онлайн покупки!?\s*$/i, "")
    .trim();
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "bg" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute("/api/public/tinting-info")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const searchParams = new URL(request.url).searchParams;
        const code = (searchParams.get("code") ?? "").trim();
        const productUrl = searchParams.get("url") ?? "";

        if (!/^\d{6,}$/.test(code)) {
          return Response.json({ tinting: null, offerValidity: null }, { status: 400, headers: CORS_HEADERS });
        }

        const tryUrls = [
          ...(productUrl && isSafeUrl(productUrl) ? [productUrl] : []),
          `https://praktiker.bg/bg/p/${encodeURIComponent(code)}`,
        ];

        let tinting: string | null = null;
        let offerValidity: string | null = null;

        for (const url of tryUrls) {
          const html = await fetchHtml(url);
          if (!html) continue;

          if (!tinting) {
            const m = html.match(/<div[^>]*class="[^"]*message-box[^"]*message-success[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (m) {
              const text = stripTags(m[1]);
              if (text && /тонира/i.test(text)) tinting = text;
            }
          }

          if (!offerValidity) {
            const v = html.match(/Офертата\s+е\s+валидна\s+от\s+(\d{2}\.\d{2}\.\d{4})\s+до\s+(\d{2}\.\d{2}\.\d{4})/i);
            if (v) offerValidity = `Офертата е валидна от ${v[1]} до ${v[2]}`;
          }

          if (tinting && offerValidity) break;
        }

        return Response.json(
          { tinting, offerValidity },
          { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=1800" } },
        );
      },
    },
  },
});