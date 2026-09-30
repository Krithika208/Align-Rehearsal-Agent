// Runs once when each server instance starts. Surfaces a missing encryption key
// in the Vercel logs straight away instead of on the first rehearsal.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    console.error(
      "[startup] ENCRYPTION_MASTER_KEY is not set. Rehearsal transcripts cannot be saved or opened until it is added in Vercel. Generate one with: openssl rand -base64 32"
    );
  }
}
