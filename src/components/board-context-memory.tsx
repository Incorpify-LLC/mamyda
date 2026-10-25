import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BOARD_SECTIONS, isBoardPath, boardSearchContext } from "@/lib/board-navigation";
import type { ProjectSearch } from "@/lib/project-context";

const BoardMemory = createContext<{
  search: ProjectSearch;
  path: string;
  ready: boolean;
  remember: (search: ProjectSearch) => void;
}>({ search: {}, path: "/board", ready: true, remember: () => {} });
/** Only account-scoped navigation metadata; never asset contents or vault keys. */
export function BoardContextMemory({ children, userId }: { children: ReactNode; userId?: string }) {
  const [search, setSearch] = useState<ProjectSearch>({});
  const [path, setPath] = useState("/board");
  const [ready, setReady] = useState(!userId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const entryPath = useRef(pathname);
  const navigate = useNavigate();
  const key = userId ? `mamyda.board-context.${encodeURIComponent(userId)}` : null;
  useEffect(() => {
    try {
      const stored = key && JSON.parse(localStorage.getItem(key) || "null");
      if (stored?.version === 1 && stored.search && typeof stored.search === "object") {
        setSearch(boardSearchContext(stored.search));
        const section = BOARD_SECTIONS.find((section) => section.to === stored.path);
        if (section) {
          setPath(section.to);
          if (entryPath.current === "/")
            void navigate({
              to: section.to,
              search: boardSearchContext(stored.search),
              replace: true,
            });
        }
      }
    } catch {
      /* Navigation still works when browser storage is unavailable. */
    }
    setReady(true);
  }, [key, navigate]);
  useEffect(() => {
    if (ready && isBoardPath(pathname)) setPath(pathname);
  }, [ready, pathname]);
  useEffect(() => {
    if (ready && key)
      try {
        localStorage.setItem(key, JSON.stringify({ version: 1, search, path }));
      } catch {}
  }, [ready, key, search, path]);
  const remember = useCallback((next: ProjectSearch) => {
    setSearch((previous) =>
      previous.clientId === next.clientId && previous.projectId === next.projectId
        ? previous
        : next,
    );
  }, []);
  return (
    <BoardMemory.Provider value={{ search, path, ready, remember }}>
      {children}
    </BoardMemory.Provider>
  );
}
export function useBoardMemory() {
  return useContext(BoardMemory);
}
