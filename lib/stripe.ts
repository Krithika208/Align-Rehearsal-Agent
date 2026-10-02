import Stripe from "stripe";

// Server-side Stripe client. Never import this into a Client Component —
// STRIPE_SECRET_KEY must stay on the server.
//
// Instantiation is lazy (on first property access) so that importing this
// module during `next build` — when env vars may be absent — doesn't throw.
let instance: Stripe | null = null;

function getStripe(): Stripe {
  if (!instance) {
    instance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }
  return instance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = client[prop as keyof Stripe];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
