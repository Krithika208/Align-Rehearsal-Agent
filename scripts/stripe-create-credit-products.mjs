// Creates the two one-off credit products in Stripe, with prices found by
// lookup key. Safe to run more than once: a lookup key that already exists is
// left alone.
//
// Test mode:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-create-credit-products.mjs
// Live mode:  STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-create-credit-products.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first.");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "LIVE" : "TEST";

const PRODUCTS = [
  {
    lookupKey: "rehearsal_single",
    name: "Align: 1 rehearsal",
    description: "One rehearsal with Jordan, up to 20 minutes. Never expires.",
    amount: 500,
  },
  {
    lookupKey: "rehearsal_pack_5",
    name: "Align: 5 rehearsals",
    description: "Five rehearsals with Jordan, up to 20 minutes each. Never expire.",
    amount: 2000,
  },
];

console.log(`Stripe ${mode} mode`);
for (const p of PRODUCTS) {
  const existing = await stripe.prices.list({ lookup_keys: [p.lookupKey], limit: 1 });
  if (existing.data[0]) {
    const price = existing.data[0];
    console.log(
      `= ${p.lookupKey} already exists: ${price.id} (${price.unit_amount / 100} ${price.currency.toUpperCase()}, active: ${price.active})`
    );
    continue;
  }
  const product = await stripe.products.create({
    name: p.name,
    description: p.description,
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: p.amount,
    lookup_key: p.lookupKey,
  });
  console.log(`+ ${p.lookupKey} created: product ${product.id}, price ${price.id}`);
}
