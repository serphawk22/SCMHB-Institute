import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const LANDING_FILE = join(process.cwd(), "public", "showcase", "index.html");

export function GET() {
  let html = readFileSync(LANDING_FILE, "utf8");

  // The landing page is authored for /showcase/index.html with relative URLs.
  // When served at /opening, rewrite them so css/js/assets/*.html still resolve.
  html = html.replace(
    /(href|src|action)\s*=\s*"([^"#]+)"/gi,
    (match: string, attr: string, url: string): string => {
      if (/^(https?:|mailto:|tel:|data:|javascript:|blob:|\/|#)/i.test(url)) {
        return match;
      }
      const target = url.trim() === "index.html" ? "/opening" : "/showcase/" + url;
      return `${attr}="${target}"`;
    }
  );

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}