import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ProjectSearch } from "@/lib/project-context";

const BoardMemory = createContext<{
  search: ProjectSearch;
  remember: (search: ProjectSearch) => void;
}>({ search: {}, remember: () => {} });
/** In-session navigation convenience only. No asset contents, cross-account storage or keys. */
export function BoardContextMemory({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<ProjectSearch>({});
  const remember = useCallback((next: ProjectSearch) => {
    setSearch((previous) =>
      previous.clientId === next.clientId && previous.projectId === next.projectId
        ? previous
        : next,
    );
  }, []);
  return <BoardMemory.Provider value={{ search, remember }}>{children}</BoardMemory.Provider>;
}
export function useBoardMemory() {
  return useContext(BoardMemory);
}
