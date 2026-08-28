import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { i as formatDayKey, n as addDays, o as formatTime, r as formatDay, u as startOfDay } from "./time-B-7xH25t.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { c as syncCalendars, n as Card, t as Button } from "./calendar-B9Go77HQ.mjs";
import { E as useWorkspace, S as useCalendar, t as AppShell } from "./hooks-BiFypmM2.mjs";
import { t as Badge } from "./badge-DuMV6xQ8.mjs";
import { t as redirectToLoginIfRequired } from "./login-C214iVwo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-B5YX_1VQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CalendarPage() {
	const cal = useCalendar();
	const ws = useWorkspace();
	const [cursor, setCursor] = (0, import_react.useState)(() => startOfDay(/* @__PURE__ */ new Date()));
	const [syncing, setSyncing] = (0, import_react.useState)(false);
	const days = (0, import_react.useMemo)(() => Array.from({ length: 7 }, (_, i) => addDays(cursor, i)), [cursor]);
	const grouped = (0, import_react.useMemo)(() => {
		const events = cal.data?.events ?? [];
		const byDay = /* @__PURE__ */ new Map();
		for (const ev of events) {
			const key = formatDayKey(ev.startsAt);
			const list = byDay.get(key) ?? [];
			list.push(ev);
			byDay.set(key, list);
		}
		return byDay;
	}, [cal.data]);
	const projectName = (id) => ws.data?.projects.find((p) => p.id === id)?.name;
	async function onSync() {
		setSyncing(true);
		try {
			const result = await syncCalendars();
			if (result.loginUrl) {
				redirectToLoginIfRequired({
					ok: false,
					data: null,
					loginRequired: true,
					loginUrl: result.loginUrl
				});
				return;
			}
			await cal.refetch();
			toast.success("Calendars refreshed");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Sync failed");
		} finally {
			setSyncing(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Calendar",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "outline",
			size: "sm",
			onClick: () => void onSync(),
			disabled: syncing,
			children: syncing ? "Syncing…" : "Sync"
		}),
		children: cal.isPending || !cal.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Loading your week…"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setCursor(addDays(cursor, -7)),
						children: "Prev"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => setCursor(startOfDay(/* @__PURE__ */ new Date())),
						children: "This week"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setCursor(addDays(cursor, 7)),
						children: "Next"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0",
				children: days.map((d) => {
					const key = formatDayKey(d);
					const count = grouped.get(key)?.length ?? 0;
					const isToday = formatDayKey(/* @__PURE__ */ new Date()) === key;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							document.getElementById(`day-${key}`)?.scrollIntoView({
								behavior: "smooth",
								block: "start"
							});
						},
						className: cn("min-w-24 rounded-lg border px-3 py-2 text-left", isToday ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs opacity-80",
							children: formatDay(d)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm font-medium tabular-nums",
							children: [count, " events"]
						})]
					}, key);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 space-y-6",
				children: days.map((d) => {
					const key = formatDayKey(d);
					const events = grouped.get(key) ?? [];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						id: `day-${key}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mb-2 font-display text-lg",
							children: formatDay(d)
						}), events.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Open"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2",
							children: events.map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								className: "flex items-start gap-4 p-4",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "w-20 shrink-0 text-sm tabular-nums text-muted-foreground",
										children: [ev.allDay ? "All day" : formatTime(ev.startsAt), ev.endsAt && !ev.allDay ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: formatTime(ev.endsAt) }) : null]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-medium",
											children: ev.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted-foreground",
											children: [ev.location, projectName(ev.projectId)].filter(Boolean).join(" · ")
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: ev.isSample ? "muted" : "primary",
										children: ev.sourceProvider
									})
								]
							}, ev.id))
						})]
					}, key);
				})
			})
		] })
	});
}
//#endregion
export { CalendarPage as component };
