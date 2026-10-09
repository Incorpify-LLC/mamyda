import { expect, test } from "vitest";
import { readPreferences } from "@/lib/personal-preferences";
test("personal choices preserve existing theme and task-view keys", () => {
  expect(
    readPreferences({
      getItem: (key) =>
        ({ "mamyda-theme": "dark", "mamyda-task-view": "list", "mamyda-density": "compact" })[
          key
        ] ?? null,
    }),
  ).toEqual({ theme: "dark", taskView: "list", density: "compact" });
});
test("invalid or unavailable storage uses safe responsive defaults", () => {
  for (const storage of [
    { getItem: () => "invalid" },
    {
      getItem: () => {
        throw new Error("Disabled");
      },
    },
  ])
    expect(readPreferences(storage)).toEqual({
      theme: "system",
      taskView: "auto",
      density: "comfortable",
    });
});
