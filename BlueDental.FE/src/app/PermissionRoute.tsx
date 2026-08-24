import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/authStore";
import { t } from "@/lib/i18n";
import { ShieldOff } from "lucide-react";

interface Props {
  permission: string | readonly string[];
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: Props) {
  const required = typeof permission === "string" ? [permission] : permission;
  const allowed = useAuthStore((state) => required.some(state.hasPermission));

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <ShieldOff className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">403</h1>
        <p className="text-xl font-medium">{t("Không có quyền truy cập")}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("Tài khoản của bạn không được cấp quyền sử dụng chức năng này.")}
        </p>
        <Button asChild>
          <a href="/">{t("Về trang chủ")}</a>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
