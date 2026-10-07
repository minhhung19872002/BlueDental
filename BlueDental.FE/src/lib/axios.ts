import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useBranchStore } from "@/lib/clinicBranch";
import { describeApiError } from "@/lib/apiError";

/**
 * Server code for a session ended because it is used from outside the
 * account's branch networks (Cụm 11 mục 11), and the reason the login screen
 * is told so it can say why the user was signed out.
 */
const LOGIN_IP_NOT_ALLOWED = "BlueDental:Auth:LoginIpNotAllowed";
export const IP_SIGNED_OUT_REASON = "ip";

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
        const ipBlocked = describeApiError(error).code === LOGIN_IP_NOT_ALLOWED;
        window.location.href = ipBlocked ? `/login?reason=${IP_SIGNED_OUT_REASON}` : "/login";
      }
    }
    return Promise.reject(error);
  },
);
