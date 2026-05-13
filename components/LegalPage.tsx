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
      <nav>
        <Link href="/" className="logo">
          <img
            src="/brand/align-lockup-navy.svg"
            alt="Align"
            width={115}
            height={32}
          />
        </Link>
        <Link href="/login" className="nav-link">
          Sign in
        </Link>
      </nav>
      <main className="legal-shell">
        <article className="legal-article">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
