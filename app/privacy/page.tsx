import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Align",
  description:
    "How Align collects, uses, and protects your personal data, and the rights you have over it.",
};

export default function Privacy() {
  return <LegalPage slug="privacy" />;
}
