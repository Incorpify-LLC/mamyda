import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { r as formatDay } from "./time-B-7xH25t.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Card, t as Button } from "./calendar-B9Go77HQ.mjs";
import { E as useWorkspace, m as saveNote, s as deleteNote, t as AppShell, w as useNotes } from "./hooks-BiFypmM2.mjs";
import { t as Badge } from "./badge-DuMV6xQ8.mjs";
import { t as Textarea } from "./textarea-DUJYKurs.mjs";
import { t as extractTags } from "./tags-gdYcVXxO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notes-tE9SK7QF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function NotesPage() {
	const list = useNotes();
	const ws = useWorkspace();
	const [filter, setFilter] = (0, import_react.useState)(null);
	const [current, setCurrent] = (0, import_react.useState)(null);
	const [draft, setDraft] = (0, import_react.useState)("");
	const allTags = (0, import_react.useMemo)(() => {
		const set = /* @__PURE__ */ new Set();
		for (const n of list.data ?? []) for (const t of n.tags) set.add(t);
		return [...set].sort();
	}, [list.data]);
	const visible = (list.data ?? []).filter((n) => filter ? n.tags.includes(filter) : true);
	const projectById = (0, import_react.useMemo)(() => new Map((ws.data?.projects ?? []).map((p) => [p.id, p])), [ws.data]);
	const liveTags = extractTags(current ? draft : "");
	async function persist(id, body) {
		const next = await saveNote({ data: {
			id,
			body: body ?? draft
		} });
		list.refetch();
		toast.success("Note saved");
		return next;
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Notes",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			size: "sm",
			onClick: () => {
				setCurrent({
					id: "",
					projectId: null,
					title: "",
					body: "",
					tags: [],
					createdAt: "",
					updatedAt: ""
				});
				setDraft("");
			},
			children: "New"
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-4 text-sm text-muted-foreground",
				children: "Tag with #project-slug to attach a note to a project. Free tags work too."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFilter(null),
					className: cn("rounded-full px-2.5 py-1 text-xs", !filter ? "bg-foreground text-background" : "bg-muted"),
					children: "All"
				}), allTags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setFilter(t),
					className: cn("rounded-full px-2.5 py-1 text-xs", filter === t ? "bg-foreground text-background" : "bg-muted"),
					children: ["#", t]
				}, t))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-[20rem_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: visible.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setCurrent(n);
							setDraft(n.body);
						},
						className: cn("w-full rounded-lg border px-3 py-2 text-left", current?.id === n.id ? "border-primary bg-card" : "border-border bg-card/60"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: n.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted-foreground",
							children: [n.updatedAt ? formatDay(n.updatedAt) : "", n.projectId ? ` · ${projectById.get(n.projectId)?.name ?? ""}` : ""]
						})]
					}, n.id))
				}), current ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							className: "min-h-72 font-sans",
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							placeholder: "Write. Use #tags."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex flex-wrap gap-1.5",
							children: liveTags.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								tone: projectById.has(t) || [...projectById.values()].some((p) => p.slug === t) ? "primary" : "muted",
								children: ["#", t]
							}, t))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								onClick: async () => {
									const notes = await persist(current.id || void 0, draft);
									const saved = notes.find((n) => n.body === draft) ?? notes[0] ?? current;
									setCurrent(saved);
									setDraft(saved.body);
								},
								children: "Save"
							}), current.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								onClick: async () => {
									await deleteNote({ data: current.id });
									setCurrent(null);
									await list.refetch();
								},
								children: "Delete"
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Select a note, or write a new one."
				})]
			})
		]
	});
}
//#endregion
export { NotesPage as component };
