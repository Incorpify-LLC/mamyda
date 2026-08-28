import { o as __toESM } from "./_runtime.mjs";
import { n as require_react } from "./_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "./_libs/radix-ui__react-context+react.mjs";
import { t as useCurrentUser } from "./_ssr/use-current-user-D8_Gc8Fk.mjs";
import { t as Skeleton } from "./_ssr/skeleton-CKPjnetS.mjs";
import { a as formatFullDay, l as sameDay, o as formatTime, s as greeting, u as startOfDay } from "./_ssr/time-B-7xH25t.mjs";
import { n as Card, t as Button } from "./_ssr/calendar-B9Go77HQ.mjs";
import { E as useWorkspace, S as useCalendar, a as colorDot, t as AppShell, w as useNotes, x as useAlerts } from "./_ssr/hooks-BiFypmM2.mjs";
import { t as Badge } from "./_ssr/badge-DuMV6xQ8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_app-Y0mdElu-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TodayPage() {
	const user = useCurrentUser();
	const ws = useWorkspace();
	const cal = useCalendar();
	const notes = useNotes();
	const alerts = useAlerts();
	const now = /* @__PURE__ */ new Date();
	const todayEvents = (0, import_react.useMemo)(() => {
		return (cal.data?.events ?? []).filter((e) => sameDay(e.startsAt, now));
	}, [cal.data, now]);
	const due = (0, import_react.useMemo)(() => {
		const tasks = ws.data?.tasks ?? [];
		const start = startOfDay(now).getTime();
		const end = start + 864e5;
		return {
			overdue: tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < start && t.columnId !== "done"),
			today: tasks.filter((t) => {
				if (!t.dueAt || t.columnId === "done") return false;
				const ts = new Date(t.dueAt).getTime();
				return ts >= start && ts < end;
			})
		};
	}, [ws.data, now]);
	const projectById = (0, import_react.useMemo)(() => {
		return new Map((ws.data?.projects ?? []).map((p) => [p.id, p]));
	}, [ws.data]);
	const clientById = (0, import_react.useMemo)(() => {
		return new Map((ws.data?.clients ?? []).map((c) => [c.id, c]));
	}, [ws.data]);
	const firstName = user?.displayName?.split(" ")[0] ?? user?.primaryEmail?.split("@")[0] ?? "there";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Today",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden text-sm text-muted-foreground tabular-nums sm:block",
			children: formatFullDay(now)
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-display text-3xl tracking-tight md:text-4xl",
				children: [
					greeting(),
					", ",
					firstName
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-sm text-muted-foreground md:hidden",
				children: [formatFullDay(now), " · Asia/Kolkata"]
			}),
			ws.isPending || cal.isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-4 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-56" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-56" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-56" })
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-4 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5 lg:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium tracking-wide text-muted-foreground uppercase",
								children: "Agenda"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/calendar",
								className: "text-sm text-primary underline-offset-4 hover:underline",
								children: "Full calendar"
							})]
						}), todayEvents.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Nothing on the books today. Connect Gmail, Outlook, or a Zoho feed in Settings."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "space-y-3",
							children: todayEvents.map((ev) => {
								const project = ev.projectId ? projectById.get(ev.projectId) : void 0;
								const client = project ? clientById.get(project.clientId) : void 0;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-16 shrink-0 text-sm tabular-nums text-muted-foreground",
											children: ev.allDay ? "All day" : formatTime(ev.startsAt)
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-medium",
												children: ev.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-muted-foreground",
												children: [
													ev.sourceProvider,
													ev.location,
													project?.name
												].filter(Boolean).join(" · ")
											})]
										}),
										client && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-1 size-2.5 shrink-0 rounded-full ${colorDot(client.color)}` })
									]
								}, ev.id);
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase",
								children: "Due"
							}),
							due.overdue.length === 0 && due.today.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: "Clear. Nothing due today."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "space-y-2",
								children: [due.overdue.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm",
										children: t.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "danger",
										children: "Overdue"
									})]
								}, t.id)), due.today.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm",
										children: t.title
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: "warn",
										children: "Today"
									})]
								}, t.id))]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/board",
								className: "mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline",
								children: "Open board"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase",
							children: "Alerts"
						}), (alerts.data?.alerts ?? []).slice(0, 5).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Quiet so far. Overdue work, due-soon tasks, and meetings in 30 minutes land here — and in the email log."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-2",
							children: (alerts.data?.alerts ?? []).slice(0, 5).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: a.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: a.body
							})] }, a.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "p-5 lg:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-medium tracking-wide text-muted-foreground uppercase",
								children: "Recent notes"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/notes",
								className: "text-sm text-primary underline-offset-4 hover:underline",
								children: "All notes"
							})]
						}), (notes.data ?? []).slice(0, 3).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted-foreground",
							children: "Scratch notes tagged with #project-slug attach themselves to a project."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-3",
							children: (notes.data ?? []).slice(0, 3).map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-medium",
								children: n.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "line-clamp-2 text-sm text-muted-foreground",
								children: n.body
							})] }, n.id))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "outline",
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/minutes",
							children: "Log minutes"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "outline",
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/notes",
							children: "New note"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						asChild: true,
						variant: "outline",
						size: "sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/vault",
							children: "Open vault"
						})
					})
				]
			})
		]
	});
}
//#endregion
export { TodayPage as component };
