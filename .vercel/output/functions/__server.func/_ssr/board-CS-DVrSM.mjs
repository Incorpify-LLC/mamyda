import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { a as DialogPortal, i as DialogOverlay, n as DialogClose, o as DialogTitle$1, r as DialogContent$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { t as cn } from "./utils-BeBjTMyx.mjs";
import { r as formatDay } from "./time-B-7xH25t.mjs";
import { t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Card, t as Button } from "./calendar-B9Go77HQ.mjs";
import { E as useWorkspace, a as colorDot, b as upsertTask, c as deleteTask, d as moveTask, n as archiveClient, r as archiveProject, t as AppShell, v as upsertClient, y as upsertProject } from "./hooks-BiFypmM2.mjs";
import { t as Badge } from "./badge-DuMV6xQ8.mjs";
import { n as PRIORITIES, r as TASK_COLUMNS, t as CLIENT_COLORS } from "./columns-CxaszSyT.mjs";
import { n as Label, t as Input } from "./label-YCOp9q5W.mjs";
import { t as Textarea } from "./textarea-DUJYKurs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/board-CS-DVrSM.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Dialog = Dialog$1;
function DialogContent({ className, children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-foreground/30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-lg", className),
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
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("font-display text-xl font-medium tracking-tight", className),
		...props
	});
}
function priorityTone(p) {
	if (p === "urgent") return "danger";
	if (p === "high") return "warn";
	return "muted";
}
function BoardPage() {
	const ws = useWorkspace();
	const [clientId, setClientId] = (0, import_react.useState)(null);
	const [projectId, setProjectId] = (0, import_react.useState)(null);
	const [clientOpen, setClientOpen] = (0, import_react.useState)(false);
	const [projectOpen, setProjectOpen] = (0, import_react.useState)(false);
	const [task, setTask] = (0, import_react.useState)(null);
	const clients = ws.data?.clients ?? [];
	const projects = ws.data?.projects ?? [];
	const tasks = ws.data?.tasks ?? [];
	const selectedClient = clientId ? clients.find((c) => c.id === clientId) : clients[0];
	const clientProjects = projects.filter((p) => p.clientId === selectedClient?.id);
	const selectedProject = projectId ? clientProjects.find((p) => p.id === projectId) ?? clientProjects[0] : clientProjects[0];
	const boardTasks = tasks.filter((t) => t.projectId === selectedProject?.id);
	async function refresh() {
		await ws.refetch();
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Board",
		action: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				size: "sm",
				onClick: () => setClientOpen(true),
				children: "Client"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "outline",
				size: "sm",
				disabled: !selectedClient,
				onClick: () => setProjectOpen(true),
				children: "Project"
			})]
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "-mx-4 flex gap-2 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0",
				children: clients.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						setClientId(c.id);
						setProjectId(null);
					},
					className: cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap", selectedClient?.id === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", colorDot(c.color)) }), c.name]
				}, c.id))
			}),
			selectedClient && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-wrap items-center gap-2",
				children: [clientProjects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setProjectId(p.id),
					className: cn("rounded-md px-3 py-1.5 text-sm", selectedProject?.id === p.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"),
					children: p.name
				}, p.id)), selectedProject && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-muted-foreground",
					children: ["#", selectedProject.slug]
				})]
			}),
			selectedProject ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "-mx-4 flex gap-3 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0",
				children: TASK_COLUMNS.map((col) => {
					const colTasks = boardTasks.filter((t) => t.columnId === col.id).sort((a, b) => a.position - b.position);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-72 shrink-0 rounded-xl border border-border bg-muted/40 p-2",
						onDragOver: (e) => e.preventDefault(),
						onDrop: (e) => {
							e.preventDefault();
							const id = e.dataTransfer.getData("text/task-id");
							if (!id) return;
							moveTask({ data: {
								id,
								columnId: col.id,
								position: Date.now()
							} }).then(refresh);
						},
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between px-2 py-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-sm font-medium",
								children: col.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs tabular-nums text-muted-foreground",
								children: colTasks.length
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [colTasks.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
								draggable: true,
								onDragStart: (e) => e.dataTransfer.setData("text/task-id", t.id),
								onClick: () => setTask(t),
								className: "cursor-grab p-3 active:cursor-grabbing",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: t.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: priorityTone(t.priority),
										children: t.priority
									}), t.dueAt && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
										tone: new Date(t.dueAt) < /* @__PURE__ */ new Date() && t.columnId !== "done" ? "danger" : "muted",
										children: formatDay(t.dueAt)
									})]
								})]
							}, t.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "w-full rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-card",
								onClick: () => setTask({
									projectId: selectedProject.id,
									columnId: col.id,
									priority: "normal",
									title: ""
								}),
								children: "Add task"
							})]
						})]
					}, col.id);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Add a client, then a project, then the work."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClientDialog, {
				open: clientOpen,
				onOpenChange: setClientOpen,
				client: selectedClient,
				onSaved: refresh
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProjectDialog, {
				open: projectOpen,
				onOpenChange: setProjectOpen,
				client: selectedClient,
				project: selectedProject,
				onSaved: refresh
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaskDialog, {
				task,
				onClose: () => setTask(null),
				onSaved: refresh
			})
		]
	});
}
function ClientDialog({ open, onOpenChange, client, onSaved }) {
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [color, setColor] = (0, import_react.useState)("sage");
	const [creating, setCreating] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setCreating(true);
		setName("");
		setEmail("");
		setColor("sage");
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: creating ? "New client" : "Edit client" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: async (e) => {
					e.preventDefault();
					await upsertClient({ data: {
						id: creating ? void 0 : client?.id,
						name,
						email,
						color
					} });
					toast.success(creating ? "Client added" : "Client saved");
					onOpenChange(false);
					onSaved();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "cname",
							children: "Name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "cname",
							value: name,
							onChange: (e) => setName(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "cemail",
							children: "Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "cemail",
							value: email,
							onChange: (e) => setEmail(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-2",
						children: CLIENT_COLORS.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setColor(c),
							className: cn("size-7 rounded-full", colorDot(c), color === c && "ring-2 ring-ring ring-offset-2"),
							"aria-label": c
						}, c))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between pt-2",
						children: [!creating && client && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: async () => {
								await archiveClient({ data: client.id });
								onOpenChange(false);
								onSaved();
							},
							children: "Archive"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "ml-auto",
							children: "Save"
						})]
					})
				]
			}),
			client && creating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "secondary",
				className: "mt-2 w-full",
				onClick: () => {
					setCreating(false);
					setName(client.name);
					setEmail(client.email ?? "");
					setColor(client.color);
				},
				children: ["Edit ", client.name]
			})
		] })
	});
}
function ProjectDialog({ open, onOpenChange, client, project, onSaved }) {
	const [name, setName] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [creating, setCreating] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		setCreating(true);
		setName("");
		setDescription("");
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: creating ? "New project" : "Edit project" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-4 space-y-3",
				onSubmit: async (e) => {
					e.preventDefault();
					if (!client) return;
					await upsertProject({ data: {
						id: creating ? void 0 : project?.id,
						clientId: client.id,
						name,
						description
					} });
					toast.success("Project saved");
					onOpenChange(false);
					onSaved();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "pname",
							children: "Name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "pname",
							value: name,
							onChange: (e) => setName(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "pdesc",
							children: "Description"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "pdesc",
							value: description,
							onChange: (e) => setDescription(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between pt-2",
						children: [!creating && project && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							onClick: async () => {
								await archiveProject({ data: project.id });
								onOpenChange(false);
								onSaved();
							},
							children: "Archive"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "submit",
							className: "ml-auto",
							children: "Save"
						})]
					})
				]
			}),
			project && creating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				variant: "secondary",
				className: "mt-2 w-full",
				onClick: () => {
					setCreating(false);
					setName(project.name);
					setDescription(project.description ?? "");
				},
				children: ["Edit ", project.name]
			})
		] })
	});
}
function TaskDialog({ task, onClose, onSaved }) {
	const [title, setTitle] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [priority, setPriority] = (0, import_react.useState)("normal");
	const [dueAt, setDueAt] = (0, import_react.useState)("");
	const open = Boolean(task);
	const isNew = !task?.id;
	(0, import_react.useEffect)(() => {
		if (!task) return;
		setTitle(task.title ?? "");
		setNotes(task.notes ?? "");
		setPriority(task.priority ?? "normal");
		setDueAt(task.dueAt ? task.dueAt.slice(0, 16) : "");
	}, [task]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (v) => {
			if (!v) onClose();
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: isNew ? "New task" : "Task" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "mt-4 space-y-3",
			onSubmit: async (e) => {
				e.preventDefault();
				if (!task?.projectId) return;
				await upsertTask({ data: {
					id: task.id,
					projectId: task.projectId,
					title,
					notes,
					columnId: task.columnId,
					priority,
					dueAt: dueAt ? new Date(dueAt).toISOString() : null
				} });
				toast.success("Task saved");
				onClose();
				onSaved();
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "ttitle",
						children: "Title"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "ttitle",
						value: title,
						onChange: (e) => setTitle(e.target.value),
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "tnotes",
						children: "Notes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
						id: "tnotes",
						value: notes,
						onChange: (e) => setNotes(e.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "tpri",
							children: "Priority"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: "tpri",
							className: "h-10 w-full rounded-md border border-input bg-card px-3 text-sm",
							value: priority,
							onChange: (e) => setPriority(e.target.value),
							children: PRIORITIES.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: p,
								children: p
							}, p))
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "tdue",
							children: "Due"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "tdue",
							type: "datetime-local",
							value: dueAt,
							onChange: (e) => setDueAt(e.target.value)
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between pt-2",
					children: [task?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "ghost",
						onClick: async () => {
							await deleteTask({ data: task.id });
							onClose();
							onSaved();
						},
						children: "Delete"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						className: "ml-auto",
						children: "Save"
					})]
				})
			]
		})] })
	});
}
//#endregion
export { BoardPage as component };
