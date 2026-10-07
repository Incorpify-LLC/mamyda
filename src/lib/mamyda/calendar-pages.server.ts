/** Follow every provider page before replacing any cached events. Never forward tokens to another host. */
export async function fetchCalendarPages(
  provider: "google" | "outlook",
  initial: URL,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<unknown[]> {
  const events: unknown[] = [];
  let url: URL | null = initial;
  const visited = new Set<string>();
  while (url) {
    if (
      url.protocol !== "https:" ||
      url.origin !== initial.origin ||
      visited.has(url.href) ||
      visited.size >= 200
    ) {
      throw new Error(
        "Calendar pagination could not be completed; previous events were kept. Retry sync.",
      );
    }
    visited.add(url.href);
    const response = await fetcher(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        ...(provider === "outlook" ? { Prefer: 'outlook.timezone="UTC"' } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error("Calendar authorization expired; reconnect in Settings → Calendars.");
      if (response.status === 403)
        throw new Error(
          "Calendar access was denied. Check calendar permissions and reconnect in Settings → Calendars.",
        );
      throw new Error(
        `Calendar provider returned ${response.status}. Previous events were kept; retry sync.`,
      );
    }
    const body = (await response.json()) as {
      items?: unknown[];
      value?: unknown[];
      nextPageToken?: string;
      "@odata.nextLink"?: string;
    };
    const page = provider === "google" ? body.items : body.value;
    if (!Array.isArray(page))
      throw new Error("Calendar returned an invalid response; previous events were kept.");
    events.push(...page);
    if (provider === "google" && body.nextPageToken) {
      url = new URL(initial);
      url.searchParams.set("pageToken", body.nextPageToken);
    } else if (provider === "outlook" && body["@odata.nextLink"]) {
      url = new URL(body["@odata.nextLink"]!);
    } else url = null;
  }
  return events;
}
