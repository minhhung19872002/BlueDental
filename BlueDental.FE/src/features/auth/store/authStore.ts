import { create } from "zustand";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  clinicId: string | null;
  clinicName: string | null;
  roles: string[];
  permissions: string[];
  passwordMustChange?: boolean;
}

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  avatarVersion: number;
  setAuth: (user: UserInfo) => void;
  clearAuth: () => void;
  hasPermission: (permission: string) => boolean;
  bumpAvatarVersion: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  avatarVersion: 0,

  setAuth: (user) => set({ user, isAuthenticated: true }),
  clearAuth: () => set({ user: null, isAuthenticated: false, avatarVersion: 0 }),

  hasPermission: (permission) =>
    get().user?.permissions.includes(permission) ?? false,

  bumpAvatarVersion: () => set((s) => ({ avatarVersion: s.avatarVersion + 1 })),
}));
