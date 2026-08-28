import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { d as useRouterState, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as DialogPortal, i as DialogOverlay, n as DialogClose, r as DialogContent, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { n as UserButton } from "./gates-BnOXYxCS.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { a as Menu, c as FileText, i as NotebookPen, l as Columns3, o as Lock, r as Settings, s as LayoutDashboard, t as X, u as CalendarDays } from "../_libs/lucide-react.mjs";
import { r as useQueryClient, t as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as createSsrRpc } from "./router-BvIUnXk2.mjs";
import { o as listCalendar, t as Button } from "./calendar-B9Go77HQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hooks-BiFypmM2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Sheet = Dialog;
function SheetContent({ className, children, side = "right", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-foreground/30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: cn("fixed z-50 flex h-full w-[min(100%,20rem)] flex-col border-border bg-card p-4 shadow-lg", side === "right" ? "top-0 right-0 border-l" : "top-0 left-0 border-r", className),
		...props,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
			className: "absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:bg-muted",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "sr-only",
				children: "Close"
			})]
		})]
	})] });
}
var NAV = [
	{
		to: "/",
		label: "Today",
		icon: LayoutDashboard
	},
	{
		to: "/calendar",
		label: "Calendar",
		icon: CalendarDays
	},
	{
		to: "/board",
		label: "Board",
		icon: Columns3
	},
	{
		to: "/minutes",
		label: "Minutes",
		icon: FileText
	},
	{
		to: "/notes",
		label: "Notes",
		icon: NotebookPen
	},
	{
		to: "/vault",
		label: "Vault",
		icon: Lock
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings
	}
];
function NavLinks({ onNavigate, compact }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: cn("flex", compact ? "flex-row gap-1" : "flex-col gap-1"),
		children: NAV.map((item) => {
			const active = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
			const Icon = item.icon;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: item.to,
				onClick: onNavigate,
				className: cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors", compact && "flex-col gap-1 px-2 py-1.5 text-[11px]", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: compact ? "size-4" : "size-4",
					strokeWidth: 1.75
				}), item.label]
			}, item.to);
		})
	});
}
function AppShell({ title, action, children }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-card/80 px-3 py-5 md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-3 pb-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-2xl tracking-tight",
							children: "Mamyda"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: "Your day, stitched."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-auto border-t border-border px-1 pt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "md:pl-56",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "icon",
							className: "md:hidden",
							onClick: () => setOpen(true),
							"aria-label": "Open menu",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-xl tracking-tight md:text-2xl",
							children: title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ml-auto flex items-center gap-2",
							children: action
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-4 py-5 pb-24 md:px-8 md:pb-10",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card/95 px-1 py-1 md:hidden",
				children: NAV.slice(0, 5).map((item) => {
					const Icon = item.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: "flex min-w-12 flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), item.label]
					}, item.to);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
				open,
				onOpenChange: setOpen,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
					side: "left",
					className: "pt-12",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display mb-4 px-3 text-2xl",
							children: "Mamyda"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavLinks, { onNavigate: () => setOpen(false) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6 px-1",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
						})
					]
				})
			})
		]
	});
}
function colorDot(color) {
	switch (color) {
		case "ink": return "bg-ink";
		case "clay": return "bg-clay";
		case "slate": return "bg-slate";
		case "olive": return "bg-olive";
		default: return "bg-sage";
	}
}
var getWorkspace = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("3a5c049d85fb686c719a9f78378f53c6532f1314b6d9ca548e30534ed4eb20d4"));
var seedWorkspace = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("9ea0d94a2c7c0e688568c31cb381a2d5a4f072761fbbb6991f9324943483fb76"));
var upsertClient = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("3ed850ca17fb87fd8582212d926fc80d07d714122b30cad46d7aa22ffe3f4cbe"));
var archiveClient = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("18bffdfe1ea714e2bd77f36581d1d2886e7f08913ce8619b2d26f705788db78f"));
var upsertProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("325003616a338be236e27d8fe74ae70562ef316cea98bf28827823c533bd21be"));
var archiveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("997a773c0fcd0bbdd2ff68a435826dabfdaf9aeffe756843b9c9c4af066592fb"));
var upsertTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("0e707eb6ec0fb82227eb424af33175a6d3aa8aa082720c7e08c7589ade6732fe"));
var moveTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("6eb0671bbdaadf26dfe7fb08b82d672ec0a4f12b32f6e508aea841e00add1b70"));
var deleteTask = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("9498a104dceb315330a9ebfa736a44abea0d28d79ac4310e7dd8ef7325b0b187"));
var updateProfile = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("8088c02bcc73b825e04c4bbc4508e31ffec94baf9ea5e0bf9938559e464a4b2c"));
var clearSampleData = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("94fc8b9fca3a7c4f67c5a1598d306369b47360c8c80a3286014616fb9b755623"));
var runAlerts = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("5d1c7e50c43a1f22442c38b13b84b42254fd893e1a05d62be127cefef2eb654b"));
var listAlerts = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("7441271781997431224359b1f5254dcbdf5342cfd608a39e43437078b8a8940c"));
var listMinutes = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("b2e0c8fb724e58549e2ec10038f94b0b3645c4af0d72d89c4d34f56e23e7e81b"));
var saveMinute = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("6772205d08fac6a28b076246a31a8710c1920f0cb5a7d0edbfb70a49fc38b158"));
var deleteMinute = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("5a3c34633e92ed964e9e329712f4312f4304881f0f87b64f33239165cd5c0624"));
var polishMinutes = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("c7dd6f284e7b4637103371cf588ab0e3e64ad2b4bd6fc67f826518ce31f1e740"));
var listNotes = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4d8be61920c2b916f7d7b330130231656d8bd7a709149c68c3752a9bbbd7a337"));
var saveNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("4f54b14bf9b1faeeca8955e4cb115560b61e5067cf0fd1a62d0c5c8344cfb20a"));
var deleteNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("9b6d20f1dd9a6bedf3c17f31959fdad0f635fd24f6727454dc6ab7ebebd5687a"));
var listVault = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("d8445d96eff593343c0744f608245391b906246de29a4a2d5d2c1c71243d3962"));
var getVaultCipher = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("9623741604d8458c9f5cb43f54d73994ba21a85dfc895be3ec1a9960a38591c5"));
var saveVaultNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("311f58173c5833df742dd4f3d2fb7c954f9518f661edecedee2aa39294b2902d"));
var deleteVaultNote = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("394c9c16041915395ae6ed95c2aa9b614371b655dc7c6e137fec8a061c7f614e"));
var saveVaultKeys = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("66e816d05ef088c46f6772c88a873df2ada0d10f48a764e42f10b319b283dcfb"));
function useWorkspace() {
	return useQuery({
		queryKey: ["workspace"],
		queryFn: async () => {
			const ws = await getWorkspace();
			if (!ws.profile.seededAt) return seedWorkspace();
			return ws;
		}
	});
}
function useCalendar() {
	const ws = useWorkspace();
	return useQuery({
		queryKey: ["calendar"],
		enabled: Boolean(ws.data?.profile.seededAt),
		queryFn: () => listCalendar()
	});
}
function useMinutes() {
	const ws = useWorkspace();
	return useQuery({
		queryKey: ["minutes"],
		enabled: Boolean(ws.data?.profile.seededAt),
		queryFn: () => listMinutes()
	});
}
function useNotes() {
	const ws = useWorkspace();
	return useQuery({
		queryKey: ["notes"],
		enabled: Boolean(ws.data?.profile.seededAt),
		queryFn: () => listNotes()
	});
}
function useVaultList() {
	return useQuery({
		queryKey: ["vault"],
		queryFn: () => listVault()
	});
}
function useAlerts() {
	const ws = useWorkspace();
	const qc = useQueryClient();
	const query = useQuery({
		queryKey: ["alerts"],
		enabled: Boolean(ws.data?.profile.seededAt),
		queryFn: async () => {
			try {
				await runAlerts();
			} catch {}
			return listAlerts();
		}
	});
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ["alerts"] });
	};
	return {
		...query,
		invalidate
	};
}
//#endregion
export { useMinutes as C, useWorkspace as E, useCalendar as S, useVaultList as T, updateProfile as _, colorDot as a, upsertTask as b, deleteTask as c, moveTask as d, polishMinutes as f, saveVaultNote as g, saveVaultKeys as h, clearSampleData as i, deleteVaultNote as l, saveNote as m, archiveClient as n, deleteMinute as o, saveMinute as p, archiveProject as r, deleteNote as s, AppShell as t, getVaultCipher as u, upsertClient as v, useNotes as w, useAlerts as x, upsertProject as y };
