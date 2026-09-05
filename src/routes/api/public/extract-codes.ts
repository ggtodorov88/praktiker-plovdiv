import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/extract-codes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { image?: string; mime?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { image, mime } = body;
        if (!image || typeof image !== "string" || image.length > 14_000_000) {
          return Response.json({ error: "Missing or too large image" }, { status: 400 });
        }
        const mediaType = typeof mime === "string" && mime.startsWith("image/") ? mime : "image/jpeg";

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "AI not configured" }, { status: 500 });
        }

        const res = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3.7-flash",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text:
                      "Extract all 6-digit numeric product codes (SAP codes) from this image. " +
                      "Return ONLY a JSON array of strings, e.g. [\"229455\",\"123456\"]. " +
                      "No other text, no markdown. If none found, return [].",
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mediaType};base64,${image}` },
                  },
                ],
              },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          return Response.json({ error: `AI error ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
        }

        const data = await res.json();
        const content: string = data?.choices?.[0]?.message?.content ?? "";
        const codes = [...new Set(content.match(/\d{6}/g) ?? [])];
        return Response.json({ codes });
      },
    },
  },
});
