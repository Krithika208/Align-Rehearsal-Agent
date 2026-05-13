import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Footer">
        <a
          href="https://livealign.co"
          target="_blank"
          rel="noopener noreferrer"
        >
          livealign.co
        </a>
        <span className="site-footer-dot" aria-hidden>
          ·
        </span>
        <Link href="/privacy">Privacy</Link>
        <span className="site-footer-dot" aria-hidden>
          ·
        </span>
        <Link href="/terms">Terms</Link>
        <span className="site-footer-dot" aria-hidden>
          ·
        </span>
        <Link href="/disclaimer">Disclaimer</Link>
      </nav>
    </footer>
  );
}
