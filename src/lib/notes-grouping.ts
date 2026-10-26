import type { Note, Project } from "@/lib/mamyda/types";

export const DEFAULT_NOTE_PROJECT_NAME = "saneax";

export type NoteProjectGroup = {
  groupKey: string;
  projectId: string | null;
  projectName: string;
  isDefaultSaneax: boolean;
  notes: Note[];
};

export function findSaneaxProject(projects: Project[]): Project | undefined {
  return projects.find(
    (p) =>
      !p.archived &&
      (p.slug.trim().toLowerCase() === DEFAULT_NOTE_PROJECT_NAME ||
        p.name.trim().toLowerCase() === DEFAULT_NOTE_PROJECT_NAME),
  );
}

export function resolveDefaultNoteProjectId(
  projects: Project[],
  contextProjectId?: string | null,
): string | null {
  if (contextProjectId) return contextProjectId;
  const saneax = findSaneaxProject(projects);
  return saneax?.id ?? null;
}

export function groupNotesByProject(notes: Note[], projects: Project[]): NoteProjectGroup[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const saneaxProject = findSaneaxProject(projects);
  const groupsByKey = new Map<string, NoteProjectGroup>();

  const ensureGroup = (project: Project | null): NoteProjectGroup => {
    if (!project) {
      if (saneaxProject) {
        return ensureGroup(saneaxProject);
      }
      const key = "default:saneax";
      let existing = groupsByKey.get(key);
      if (!existing) {
        existing = {
          groupKey: key,
          projectId: null,
          projectName: DEFAULT_NOTE_PROJECT_NAME,
          isDefaultSaneax: true,
          notes: [],
        };
        groupsByKey.set(key, existing);
      }
      return existing;
    }

    const key = `project:${project.id}`;
    let existing = groupsByKey.get(key);
    if (!existing) {
      const isSaneax =
        project.id === saneaxProject?.id ||
        project.slug.trim().toLowerCase() === DEFAULT_NOTE_PROJECT_NAME ||
        project.name.trim().toLowerCase() === DEFAULT_NOTE_PROJECT_NAME;
      existing = {
        groupKey: key,
        projectId: project.id,
        projectName: project.name,
        isDefaultSaneax: isSaneax,
        notes: [],
      };
      groupsByKey.set(key, existing);
    }
    return existing;
  };

  for (const note of notes) {
    const project = note.projectId ? (projectById.get(note.projectId) ?? null) : null;
    const group = ensureGroup(project);
    group.notes.push(note);
  }

  const allGroups = [...groupsByKey.values()];
  allGroups.sort((a, b) => {
    if (a.isDefaultSaneax !== b.isDefaultSaneax) {
      return a.isDefaultSaneax ? -1 : 1;
    }
    const indexA = a.projectId ? projects.findIndex((p) => p.id === a.projectId) : -1;
    const indexB = b.projectId ? projects.findIndex((p) => p.id === b.projectId) : -1;
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    return a.projectName.localeCompare(b.projectName);
  });

  return allGroups;
}
