import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy — Align",
  description: "How Align uses cookies and similar technologies, and how to change your choice.",
};

export default function Cookies() {
  return <LegalPage slug="cookies" />;
}
