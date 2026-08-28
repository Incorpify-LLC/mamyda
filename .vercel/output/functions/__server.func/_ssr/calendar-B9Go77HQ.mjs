import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { s as Slot } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { r as createServerFn } from "./ssr.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { t as authMiddleware } from "./middleware-SfUgAAb_.mjs";
import { n as createSsrRpc } from "./router-BvIUnXk2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-B9Go77HQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors transition-transform duration-150 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary/90",
			secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
			outline: "border border-border bg-card text-foreground hover:bg-muted",
			ghost: "text-foreground hover:bg-muted",
			destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
		},
		size: {
			default: "h-10 px-4",
			sm: "h-8 rounded-sm px-3 text-xs",
			lg: "h-11 px-5",
			icon: "size-10"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = (0, import_react.forwardRef)(function Button({ className, variant, size, type = "button", asChild, ...props }, ref) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		ref,
		type: asChild ? void 0 : type,
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
});
function Card({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_0_rgba(27,25,21,0.04)]", className),
		...props
	});
}
var listCalendar = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("aaf51015208128c4a12dca47e9fe1bbe849844e81f5cb02d6a18e467cf4bdacd"));
var addIcsSource = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("fdaa301df6e0a073b34d5f236bd38a2680aa69edfc2a1adac6f7e9e0532a4d56"));
var connectProvider = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("dbfa0a99995683c105df3ce6877b126902d5df9a5384b7de96cd122c3e11c5d7"));
var syncCalendars = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(createSsrRpc("41091f29cf08cac80a697ae03814adb877c8b8064d6e3cdc4800d3ca6827ea87"));
var removeSource = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("479af36958893b297c90c8ddea204c0d29211608132374386e55124a2e6690d4"));
var beginGrokLogin = createServerFn({ method: "POST" }).handler(createSsrRpc("e4fc87d8f6660bded8cd5330e01389a7dd72154d4946da88b4fc25eacb527851"));
//#endregion
export { connectProvider as a, syncCalendars as c, beginGrokLogin as i, Card as n, listCalendar as o, addIcsSource as r, removeSource as s, Button as t };
