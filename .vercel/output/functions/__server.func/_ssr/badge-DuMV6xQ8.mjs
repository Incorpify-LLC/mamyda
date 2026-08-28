import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-DuMV6xQ8.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "muted", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide", tone === "muted" && "bg-muted text-muted-foreground", tone === "primary" && "bg-primary/10 text-primary", tone === "warn" && "bg-amber-100 text-amber-900", tone === "danger" && "bg-red-100 text-red-900", tone === "ok" && "bg-emerald-100 text-emerald-900", className),
		...props
	});
}
//#endregion
export { Badge as t };
