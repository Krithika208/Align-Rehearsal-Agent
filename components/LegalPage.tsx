import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import SiteFooter from "./SiteFooter";

// "5. Cookies and analytics" → "cookies-and-analytics", so sections can be
// linked to (e.g. /privacy#cookies-and-analytics from the cookie banner).
function headingId(children: React.ReactNode): string {
  const text = Array.isArray(children) ? children.join("") : String(children ?? "");
  return text
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function LegalPage({ slug }: { slug: string }) {
  const filePath = path.join(process.cwd(), "content", "legal", `${slug}.md`);
  const markdown = await fs.readFile(filePath, "utf8");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <nav>
        <Link href="/" className="logo" aria-label="Align home">
          <img
            src="/brand/align-lockup-navy.svg"
            alt="Align"
            width={115}
            height={32}
          />
        </Link>
        <HeaderMenu
          variant="site"
          loggedIn={!!user}
          links={[
            user
              ? { href: "/account", label: "Account" }
              : { href: "/login", label: "Sign in" },
            { href: "https://livealign.co", label: "Coaching" },
          ]}
        />
      </nav>
      <main className="legal-shell">
        <article className="legal-article">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
              // Wide tables scroll sideways on a phone instead of squashing.
              table: ({ children }) => (
                <div className="legal-table-wrap">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
