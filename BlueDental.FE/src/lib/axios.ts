import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "RequestVerificationToken",
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
