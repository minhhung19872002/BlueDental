import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useBranchStore } from "@/lib/clinicBranch";
import { describeApiError } from "@/lib/apiError";

/**
 * Why the server ended a session (Cụm 11 mục 11 / 13), and the reason the
 * login screen is told so it can say why the user was signed out.
 */
const SIGNED_OUT_REASONS: Readonly<Record<string, SignedOutReason>> = {
  "BlueDental:Auth:LoginIpNotAllowed": "ip",
  "BlueDental:Auth:LoginOutsideHours": "hours",
};

export type SignedOutReason = "ip" | "hours";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "RequestVerificationToken",
  // Axios writes an array as `key[]=a&key[]=b`, which ASP.NET Core does not
  // bind to a collection — it silently returns everything. `indexes: null`
  // repeats the bare key instead, which it does bind.
  paramsSerializer: { indexes: null },
  headers: {
    "Content-Type": "application/json",
    "Accept-Language": "vi",
  },
});

/**
 * The language the API answers in. Server messages (business errors, validation)
 * follow the language the user picked, so this moves with the UI switch.
 */
export function setAcceptLanguage(language: string): void {
  api.defaults.headers.common["Accept-Language"] = language;
}

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.headers.set("Content-Type", false);
  }

  const branchId = useBranchStore.getState().currentBranchId;
  if (branchId) {
    config.headers.set("X-Clinic-Branch-Id", branchId);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== "/login") {
        const reason = SIGNED_OUT_REASONS[describeApiError(error).code ?? ""];
        window.location.href = reason ? `/login?reason=${reason}` : "/login";
      }
    }
    return Promise.reject(error);
  },
);
