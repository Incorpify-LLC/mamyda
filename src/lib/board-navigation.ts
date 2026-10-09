export const BOARD_SECTIONS = [
  { to: "/board", label: "Tasks" },
  { to: "/minutes", label: "Minutes" },
  { to: "/notes", label: "Notes" },
  { to: "/files", label: "Files" },
  { to: "/vault", label: "Vault" },
] as const;

export function isBoardPath(path: string): boolean {
  return BOARD_SECTIONS.some((section) => path === section.to || path.startsWith(`${section.to}/`));
}

export function boardSearchContext(search: Record<string, unknown>): {
  clientId?: string;
  projectId?: string;
} {
  return {
    ...(typeof search.clientId === "string" && search.clientId
      ? { clientId: search.clientId }
      : {}),
    ...(typeof search.projectId === "string" && search.projectId
      ? { projectId: search.projectId }
      : {}),
  };
}
