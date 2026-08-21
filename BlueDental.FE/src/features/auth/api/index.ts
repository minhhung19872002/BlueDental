import { api } from "@/lib/axios";
import type { CurrentUserDto, LoginRequest, LoginResponse } from "../types";

export const authApi = {
  initializeCsrf: (): Promise<void> =>
    api
      .get("/abp/application-configuration", {
        params: { IncludeLocalizationResources: false },
      })
      .then(() => undefined),

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    await authApi.initializeCsrf();
    const response = await api.post<LoginResponse>("/account/login", data);
    if (response.data.result === 1) {
      await authApi.initializeCsrf();
    }
    return response.data;
  },

  logout: async (): Promise<void> => {
    return api.get<void>("/account/logout").then(() => undefined);
  },

  getCurrentUser: (): Promise<CurrentUserDto> =>
    api.get<CurrentUserDto>("/v1/app/current-user").then((r) => r.data),

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await authApi.initializeCsrf();
    return api
      .post<void>("/v1/app/account/change-password", data)
      .then(() => undefined);
  },
};
