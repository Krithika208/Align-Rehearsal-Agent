// Deletes a user's PostHog person (and their events) when they delete their
// account. Server-only: needs a PostHog personal API key with person write
// access, which can delete data, unlike the public project key.
//
// POSTHOG_PERSONAL_API_KEY  required; without it nothing is deleted (logged)
// POSTHOG_PROJECT_ID        optional, defaults to Align's project 668429
// POSTHOG_API_HOST          optional, defaults to https://us.posthog.com
//                           (the app's data goes to us.i.posthog.com)

export type PostHogDeleteResult = "deleted" | "not_found" | "not_configured";

export async function deletePostHogPerson(distinctId: string): Promise<PostHogDeleteResult> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!key) return "not_configured";
  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const project = process.env.POSTHOG_PROJECT_ID || "668429";
  const headers = { Authorization: `Bearer ${key}` };

  const found = await fetch(
    `${host}/api/projects/${project}/persons/?distinct_id=${encodeURIComponent(distinctId)}`,
    { headers, cache: "no-store" }
  );
  if (!found.ok) throw new Error(`PostHog person lookup ${found.status}`);
  const { results } = (await found.json()) as { results?: { id: string }[] };
  if (!results?.length) return "not_found";

  for (const person of results) {
    const res = await fetch(
      `${host}/api/projects/${project}/persons/${person.id}/?delete_events=true`,
      { method: "DELETE", headers }
    );
    if (!res.ok && res.status !== 404) throw new Error(`PostHog person delete ${res.status}`);
  }
  return "deleted";
}
