import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { o as formatTime, r as formatDay } from "./time-B-7xH25t.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Card, t as Button } from "./calendar-B9Go77HQ.mjs";
import { C as useMinutes, E as useWorkspace, S as useCalendar, f as polishMinutes, o as deleteMinute, p as saveMinute, t as AppShell } from "./hooks-BiFypmM2.mjs";
import { n as Label, t as Input } from "./label-YCOp9q5W.mjs";
import { t as Textarea } from "./textarea-DUJYKurs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/minutes-C03YRBV3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function emptyMinute() {
	return {
		id: "",
		eventId: null,
		projectId: null,
		title: "",
		attendees: "",
		body: "",
		createdAt: "",
		updatedAt: ""
	};
}
function MinutesPage() {
	const list = useMinutes();
	const ws = useWorkspace();
	const cal = useCalendar();
	const [current, setCurrent] = (0, import_react.useState)(emptyMinute());
	const [polishing, setPolishing] = (0, import_react.useState)(false);
	const selectedId = current.id || null;
	const events = (0, import_react.useMemo)(() => cal.data?.events ?? [], [cal.data]);
	async function persist() {
		const id = await saveMinute({ data: {
			id: current.id || void 0,
			title: current.title,
			body: current.body,
			attendees: current.attendees,
			eventId: current.eventId,
			projectId: current.projectId
		} });
		await list.refetch();
		setCurrent((c) => ({
			...c,
			id
		}));
		toast.success("Minutes saved");
	}
	async function polish() {
		setPolishing(true);
		try {
			const result = await polishMinutes({ data: {
				title: current.title,
				body: current.body,
				attendees: current.attendees
			} });
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			setCurrent((c) => ({
				...c,
				body: result.text
			}));
			toast.success("Polished — review, then save");
		} finally {
			setPolishing(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Minutes",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			size: "sm",
			onClick: () => setCurrent(emptyMinute()),
			children: "New"
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 lg:grid-cols-[18rem_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [(list.data ?? []).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setCurrent(m),
					className: cn("w-full rounded-lg border px-3 py-2 text-left", selectedId === m.id ? "border-primary bg-card" : "border-border bg-card/60"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: m.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: m.updatedAt ? formatDay(m.updatedAt) : ""
					})]
				}, m.id)), (list.data ?? []).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Capture what was said. Attach a meeting or a project."
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "mtitle",
								children: "Title"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "mtitle",
								value: current.title,
								onChange: (e) => setCurrent((c) => ({
									...c,
									title: e.target.value
								})),
								placeholder: "Kickoff, review, 1:1…"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-3 md:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "mevent",
									children: "Meeting"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									id: "mevent",
									className: "h-10 w-full rounded-md border border-input bg-card px-3 text-sm",
									value: current.eventId ?? "",
									onChange: (e) => {
										const eventId = e.target.value || null;
										const ev = events.find((x) => x.id === eventId);
										setCurrent((c) => ({
											...c,
											eventId,
											title: c.title || ev?.title || c.title,
											projectId: c.projectId || ev?.projectId || null
										}));
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "None"
									}), events.slice(0, 40).map((ev) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: ev.id,
										children: [
											formatDay(ev.startsAt),
											" ",
											formatTime(ev.startsAt),
											" · ",
											ev.title
										]
									}, ev.id))]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "mproj",
									children: "Project"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									id: "mproj",
									className: "h-10 w-full rounded-md border border-input bg-card px-3 text-sm",
									value: current.projectId ?? "",
									onChange: (e) => setCurrent((c) => ({
										...c,
										projectId: e.target.value || null
									})),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "None"
									}), (ws.data?.projects ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: p.id,
										children: p.name
									}, p.id))]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "matt",
								children: "Attendees"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "matt",
								value: current.attendees,
								onChange: (e) => setCurrent((c) => ({
									...c,
									attendees: e.target.value
								}))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "mbody",
								children: "Notes"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "mbody",
								className: "min-h-56",
								value: current.body,
								onChange: (e) => setCurrent((c) => ({
									...c,
									body: e.target.value
								})),
								placeholder: "Bullets are fine. Polish turns them into minutes."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => void persist(),
									children: "Save"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									disabled: polishing || !current.body.trim(),
									onClick: () => void polish(),
									children: polishing ? "Polishing…" : "Polish with Grok"
								}),
								current.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: async () => {
										await deleteMinute({ data: current.id });
										setCurrent(emptyMinute());
										await list.refetch();
									},
									children: "Delete"
								})
							]
						})
					]
				})
			})]
		})
	});
}
//#endregion
export { MinutesPage as component };
