"use server";

import { sendWithdrawalEmails } from "@/lib/emails/withdrawal";

export type WithdrawState = { status: "idle" | "sent" | "error"; message?: string };

const PURCHASES = ["1 rehearsal", "5 rehearsals"];

function field(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function submitWithdrawal(
  _prev: WithdrawState,
  formData: FormData
): Promise<WithdrawState> {
  // Hidden field people never see; bots fill it in. Pretend it worked.
  if (field(formData, "website", 200)) return { status: "sent" };

  const name = field(formData, "name", 200);
  const email = field(formData, "email", 320);
  const purchaseDate = field(formData, "purchase_date", 10);
  const purchase = field(formData, "purchase", 50);
  const notes = field(formData, "notes", 2000);

  if (!name || !email || !purchaseDate || !purchase) {
    return { status: "error", message: "Please fill in every field marked as required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please check your email address." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || Number.isNaN(Date.parse(purchaseDate))) {
    return { status: "error", message: "Please check the date of purchase." };
  }
  if (!PURCHASES.includes(purchase)) {
    return { status: "error", message: "Please choose what you bought." };
  }

  try {
    await sendWithdrawalEmails({ name, email, purchaseDate, purchase, notes });
  } catch (err) {
    console.error("[withdraw] send failed:", err instanceof Error ? err.message : err);
    return {
      status: "error",
      message:
        "Sorry, we couldn't send your request. Please try again, or email hello@livealign.co.",
    };
  }
  return { status: "sent" };
}
