/** Providers occasionally echo editing metadata. Never paste that envelope into a draft. */
export function editedText(output: string): string {
  const trimmed = output.trim();
  const candidate = trimmed.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1").trim();
  if (candidate.startsWith("{")) {
    let value: unknown;
    try {
      value = JSON.parse(candidate);
    } catch {
      if (/"(?:content|attendees|title)"\s*:/.test(candidate))
        throw new Error("Provider returned a broken editing wrapper. Your draft is unchanged.");
      return output;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      if (Object.keys(object).some((key) => ["content", "attendees", "title"].includes(key))) {
        if (
          typeof object.content !== "string" ||
          !object.content.trim() ||
          Object.keys(object).some((key) => !["content", "attendees", "title"].includes(key))
        )
          throw new Error(
            "Provider returned an unusable editing wrapper. Your draft is unchanged.",
          );
        return object.content;
      }
    }
  }
  return output;
}
