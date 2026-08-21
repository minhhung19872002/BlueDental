export interface LoginRequest {
  userNameOrEmailAddress: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  result: number;
  description: string;
  lockoutMinutes?: number | null;
}

export interface CurrentUserDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicLogoUrl: string | null;
  clinicTagline: string | null;
  roles: string[];
  permissions: string[];
  passwordMustChange: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  userId: string;
  resetToken: string;
  password: string;
}
