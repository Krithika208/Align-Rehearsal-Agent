import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteFooter from "./SiteFooter";

export default async function LegalPage({ slug }: { slug: string }) {
  const filePath = path.join(process.cwd(), "content", "legal", `${slug}.md`);
  const markdown = await fs.readFile(filePath, "utf8");

  return (
    <>
      <header className="legal-header">
        <Link href="/" className="auth-logo" aria-label="Back to Align home">
          align<span>.</span>
        </Link>
      </header>
      <main className="legal-shell">
        <article className="legal-article">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
