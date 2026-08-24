import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/authStore";
import { authApi } from "@/features/auth/api";
import { t } from "@/lib/i18n";

interface Props {
  children: ReactNode;
}

export function PrivateRoute({ children }: Props) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  const currentUser = useQuery({
    queryKey: ["auth", "current-user"],
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (currentUser.data) {
      setAuth({
        id: currentUser.data.id,
        name: currentUser.data.name,
        email: currentUser.data.email,
        clinicId: currentUser.data.clinicId,
        clinicName: currentUser.data.clinicName,
        clinicLogoUrl: currentUser.data.clinicLogoUrl,
        clinicTagline: currentUser.data.clinicTagline,
        roles: currentUser.data.roles,
        permissions: currentUser.data.permissions,
      });
    } else if (currentUser.isError) {
      clearAuth();
    }
  }, [clearAuth, currentUser.data, currentUser.isError, setAuth]);

  if (
    currentUser.isLoading ||
    (currentUser.data && user?.id !== currentUser.data.id)
  ) {
    return (
      <div
        style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">{t("Đang xác thực phiên đăng nhập")}</span>
        </div>
      </div>
    );
  }

  if (currentUser.isError) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
