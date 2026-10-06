import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Holds the user on the screen while `dirty`: an in-app navigation (route or
 * search-param change, e.g. another settings tab) is parked for the caller to
 * confirm, and a reload or tab close gets the browser's own leave prompt.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  return {
    isBlocked: blocker.state === "blocked",
    proceed: () => {
      if (blocker.state === "blocked") blocker.proceed();
    },
    stay: () => {
      if (blocker.state === "blocked") blocker.reset();
    },
  };
}
