import { useCallback } from "react";
import { toast } from "sonner";

/**
 * Runs one write, toasts once the server has answered and reports whether it
 * went through. A refusal is already shown by the query client with the
 * server's own words, so the caller only has to keep its dialog open.
 */
export function useRunCommand() {
  return useCallback(async (work: () => Promise<unknown>, success: string): Promise<boolean> => {
    try {
      await work();
      toast.success(success);
      return true;
    } catch {
      return false;
    }
  }, []);
}
