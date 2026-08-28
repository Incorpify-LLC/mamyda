const TAG_RE = /#([a-zA-Z][a-zA-Z0-9_-]{0,47})/g;

export function extractTags(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TAG_RE)) {
    const tag = match[1]?.toLowerCase();
    if (tag) found.add(tag);
  }
  return [...found];
}

export function titleFromBody(body: string): string {
  const line =
    body
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .find((l) => l.length > 0) ?? "Untitled note";
  return line.replace(/#([a-zA-Z][a-zA-Z0-9_-]{0,47})/g, "$1").slice(0, 80);
}
