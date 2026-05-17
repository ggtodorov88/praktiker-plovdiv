import { createServerFn } from "@tanstack/react-start";

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

export const getTintingInfo = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { code?: string; url?: string };
    if (!d || typeof d.code !== "string") throw new Error("code required");
    return { code: d.code, url: typeof d.url === "string" ? d.url : undefined };
  })
  .handler(async ({ data }) => {
    const tryUrls: string[] = [];
    if (data.url) tryUrls.push(data.url);
    tryUrls.push(`https://praktiker.bg/bg/p/${encodeURIComponent(data.code)}`);

    let tinting: string | null = null;
    let offerValidity: string | null = null;

    for (const u of tryUrls) {
      try {
        const res = await fetch(u, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "bg" },
          redirect: "follow",
        });
        if (!res.ok) continue;
        const html = await res.text();
        if (!tinting) {
          const m = html.match(
            /<div[^>]*class="[^"]*message-box[^"]*message-success[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          );
          if (m) {
            const text = stripTags(m[1]);
            if (text && /тонира/i.test(text)) tinting = text;
          }
        }
        if (!offerValidity) {
          const v = html.match(
            /Офертата\s+е\s+валидна\s+от\s+(\d{2}\.\d{2}\.\d{4})\s+до\s+(\d{2}\.\d{2}\.\d{4})/i,
          );
          if (v) offerValidity = `Офертата е валидна от ${v[1]} до ${v[2]}`;
        }
        if (tinting && offerValidity) break;
      } catch {
        // try next
      }
    }
    return { tinting, offerValidity };
  });
