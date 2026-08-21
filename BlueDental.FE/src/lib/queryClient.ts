import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { logApiError, notifyApiError } from "./notify";

const SKIP_GLOBAL_ERROR_TOAST = "skipGlobalErrorToast";

function isOptedOut(meta: Record<string, unknown> | undefined): boolean {
  return meta?.[SKIP_GLOBAL_ERROR_TOAST] === true;
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      logApiError(error, mutation.options.mutationKey?.join("/"));
      if (isOptedOut(mutation.meta)) return;
      if (typeof mutation.options.onError === "function") return;
      notifyApiError(error);
    },
  }),

  queryCache: new QueryCache({
    onError: (error, query) => {
      logApiError(error, query.queryHash);
      if (isOptedOut(query.meta) || query.state.data === undefined) return;
      notifyApiError(error);
    },
  }),

  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
