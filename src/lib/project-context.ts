type ClientRef = { id: string; name: string; archived: boolean };
type ProjectRef = ClientRef & { clientId: string };
export type ProjectSearch = { clientId?: string; projectId?: string };

export function resolveProjectContext<C extends ClientRef, P extends ProjectRef>(
  clients: C[],
  projects: P[],
  requested: ProjectSearch,
  defaultProject = false,
) {
  const activeClients = clients.filter((item) => !item.archived);
  const activeProjects = projects.filter(
    (item) => !item.archived && activeClients.some((client) => client.id === item.clientId),
  );
  const project = requested.projectId
    ? activeProjects.find((item) => item.id === requested.projectId)
    : undefined;
  const client = requested.clientId
    ? activeClients.find((item) => item.id === requested.clientId)
    : project
      ? activeClients.find((item) => item.id === project.clientId)
      : undefined;
  const invalid = Boolean(
    (requested.clientId && !client) ||
    (requested.projectId && !project) ||
    (client && project && client.id !== project.clientId),
  );
  if (invalid)
    return {
      client: undefined,
      project: undefined,
      search: requested,
      invalid,
      clients: activeClients,
      projects: activeProjects,
    };
  const resolvedClient = client ?? (defaultProject ? activeClients[0] : undefined);
  const resolvedProject =
    project ??
    (defaultProject
      ? activeProjects.find((item) => item.clientId === resolvedClient?.id)
      : undefined);
  return {
    client: resolvedClient,
    project: resolvedProject,
    search: {
      ...(resolvedClient ? { clientId: resolvedClient.id } : {}),
      ...(resolvedProject ? { projectId: resolvedProject.id } : {}),
    },
    invalid,
    clients: activeClients,
    projects: activeProjects,
  };
}
