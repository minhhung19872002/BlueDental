import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useBranchStore } from "@/lib/clinicBranch";

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
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
