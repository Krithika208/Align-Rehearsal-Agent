import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Align",
  description:
    "The terms governing your use of Align, our AI-powered conversation rehearsal service.",
};

export default function Terms() {
  return <LegalPage slug="terms" />;
}
