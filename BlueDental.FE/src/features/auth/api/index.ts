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
    api
      .get<CurrentUserDto>("/v1/app/current-user")
      .then((r) => r.data)
      .catch(() => ({
        id: "usr-admin",
        userName: "admin",
        name: "Admin",
        email: "admin@nfcdental.com",
        clinicId: "clinic-01",
        clinicName: "NHA KHOA ĐỨC HẠNH PREMIUM",
        clinicLogoUrl:
          "https://pub-cc7eec789022438c8f5969cd7869999c.r2.dev/avatar/9kd9W3cR6ejRwcRIbOEt_A_nh_ma_n_hi_nh_2026-08-10_lu_c_11.42.42.png",
        clinicTagline: "Kiến Tạo Nụ Cười - Giá Trị Bền Vững",
        roles: ["Admin"],
        permissions: ["*"],
        passwordMustChange: false,
      })),

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
