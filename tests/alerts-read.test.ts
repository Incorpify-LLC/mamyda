import { expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({
  options: [] as Array<{ queryFn: () => Promise<unknown>; enabled?: boolean }>,
  list: vi.fn(async () => ({ alerts: [], emails: [] })),
  run: vi.fn(async () => ({})),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: (typeof state.options)[number]) => {
    state.options.push(options);
    return { isSuccess: true };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: vi.fn(),
}));
vi.mock("@/lib/mamyda/workspace", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/mamyda/calendar", () => ({ listCalendar: vi.fn() }));
vi.mock("@/lib/mamyda/writing", () => ({
  listMinutes: vi.fn(),
  listNotes: vi.fn(),
  listVault: vi.fn(),
}));
vi.mock("@/lib/mamyda/alerts", () => ({ listAlerts: state.list, runAlerts: state.run }));
import { useAlerts } from "@/lib/mamyda/hooks";

test("opening or refetching alert views only lists data, never dispatches", async () => {
  state.options.length = 0;
  useAlerts();
  const query = state.options.at(-1)!;
  await query.queryFn();
  await query.queryFn();
  expect(state.list).toHaveBeenCalledTimes(2);
  expect(state.run).not.toHaveBeenCalled();
});
test("collapsed Settings logs can opt out of fetching", () => {
  useAlerts({ enabled: false });
  expect(state.options.at(-1)?.enabled).toBe(false);
});
