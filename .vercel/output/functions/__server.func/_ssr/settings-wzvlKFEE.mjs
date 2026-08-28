import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { o as formatTime, r as formatDay } from "./time-B-7xH25t.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as connectProvider, n as Card, r as addIcsSource, s as removeSource, t as Button } from "./calendar-B9Go77HQ.mjs";
import { E as useWorkspace, S as useCalendar, _ as updateProfile, i as clearSampleData, t as AppShell, x as useAlerts } from "./hooks-BiFypmM2.mjs";
import { t as Badge } from "./badge-DuMV6xQ8.mjs";
import { n as Label, t as Input } from "./label-YCOp9q5W.mjs";
import { t as redirectToLoginIfRequired } from "./login-C214iVwo.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-wzvlKFEE.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	const ws = useWorkspace();
	const cal = useCalendar();
	const alerts = useAlerts();
	const profile = ws.data?.profile;
	const [icsName, setIcsName] = (0, import_react.useState)("Zoho");
	const [icsUrl, setIcsUrl] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const alertEmail = email || profile?.alertEmail || "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Settings",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-2xl space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Calendars"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted-foreground",
							children: "Gmail and Outlook use Grok connectors when this app is published. Zoho (and anything else) can be added as an iCal URL."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex flex-wrap gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								onClick: async () => {
									const result = await connectProvider({ data: { provider: "google" } });
									if ("loginRequired" in result && result.loginRequired && result.loginUrl) {
										redirectToLoginIfRequired({
											ok: false,
											data: null,
											loginRequired: true,
											loginUrl: result.loginUrl
										});
										return;
									}
									await cal.refetch();
									toast.success("Google calendar connected");
								},
								children: "Connect Gmail"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								onClick: async () => {
									const result = await connectProvider({ data: { provider: "outlook" } });
									if ("loginRequired" in result && result.loginRequired && result.loginUrl) {
										redirectToLoginIfRequired({
											ok: false,
											data: null,
											loginRequired: true,
											loginUrl: result.loginUrl
										});
										return;
									}
									await cal.refetch();
									toast.success("Outlook connected");
								},
								children: "Connect Outlook"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "mt-5 grid gap-3 sm:grid-cols-[8rem_1fr_auto]",
							onSubmit: async (e) => {
								e.preventDefault();
								await addIcsSource({ data: {
									name: icsName,
									url: icsUrl,
									provider: "zoho"
								} });
								setIcsUrl("");
								await cal.refetch();
								toast.success("Calendar feed added");
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: icsName,
									onChange: (e) => setIcsName(e.target.value),
									placeholder: "Name"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: icsUrl,
									onChange: (e) => setIcsUrl(e.target.value),
									placeholder: "https://calendar.zoho.com/ical/…",
									required: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									type: "submit",
									children: "Add feed"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-4 space-y-2",
							children: (cal.data?.sources ?? []).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-2 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									s.name,
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: s.provider }),
									s.lastError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-2 text-destructive",
										children: s.lastError
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									size: "sm",
									onClick: async () => {
										await removeSource({ data: s.id });
										await cal.refetch();
									},
									children: "Remove"
								})]
							}, s.id))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Email alerts"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-sm text-muted-foreground",
							children: [
								"From ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "alerts@mamyda.saneax.in"
								}),
								" to you. Queued here now; Cloudflare Email Sending is the production path."
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "alert-email",
								children: "Your inbox"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "alert-email",
								type: "email",
								defaultValue: profile?.alertEmail ?? "",
								onChange: (e) => setEmail(e.target.value),
								placeholder: "you@saneax.in"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 space-y-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										defaultChecked: profile?.alertsDueSoon ?? true,
										onChange: (e) => void updateProfile({ data: { alertsDueSoon: e.target.checked } })
									}), "Due in 24 hours"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										defaultChecked: profile?.alertsOverdue ?? true,
										onChange: (e) => void updateProfile({ data: { alertsOverdue: e.target.checked } })
									}), "Overdue tasks"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "checkbox",
										defaultChecked: profile?.alertsMeeting ?? true,
										onChange: (e) => void updateProfile({ data: { alertsMeeting: e.target.checked } })
									}), "Meetings in 30 minutes"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-4",
							variant: "outline",
							onClick: async () => {
								await updateProfile({ data: { alertEmail: alertEmail || null } });
								await ws.refetch();
								toast.success("Alert preferences saved");
							},
							children: "Save"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-medium",
								children: "Outbound log"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-2 space-y-2",
								children: [(alerts.data?.emails ?? []).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "text-sm",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-muted-foreground",
											children: [
												formatDay(m.createdAt),
												" ",
												formatTime(m.createdAt)
											]
										}),
										" ",
										m.subject
									]
								}, m.id)), (alerts.data?.emails ?? []).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "text-sm text-muted-foreground",
									children: "No mail logged yet."
								})]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Workspace"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted-foreground",
							children: "Timezone is Asia/Kolkata. Sample clients and events are there so the desk is not empty — remove them when you are ready."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "mt-4",
							variant: "outline",
							onClick: async () => {
								await clearSampleData();
								await ws.refetch();
								await cal.refetch();
								toast.success("Sample data removed");
							},
							children: "Remove sample data"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl",
							children: "Cloudflare production"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted-foreground",
							children: "DNS for mamyda.saneax.in is already in place. When you are ready to host this on Cloudflare:"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
							className: "mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Workers Paid + Zero Trust on the account" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Worker custom domain mamyda.saneax.in" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "D1 database for this schema, private R2 bucket for vault blobs" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Access policy: your email only, one-time PIN or Google" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Email Sending onboarded on mamyda.saneax.in" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Cron every 10 minutes to sync calendars and fire alerts" })
							]
						})
					]
				})
			]
		})
	});
}
//#endregion
export { SettingsPage as component };
