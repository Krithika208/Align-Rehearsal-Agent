import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "AI Coaching Disclaimer — Align",
  description:
    "What Align is and isn't, the limits of AI coaching, and crisis resources if you need them.",
};

export default function Disclaimer() {
  return <LegalPage slug="disclaimer" />;
}
