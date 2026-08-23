import type { ReactNode } from "react";
import { Button, Result } from "antd";
import { useAuthStore } from "@/features/auth/store/authStore";
import { t } from "@/lib/i18n";

interface Props {
  permission: string | readonly string[];
  children: ReactNode;
}

export function PermissionRoute({ permission, children }: Props) {
  const required = typeof permission === "string" ? [permission] : permission;
  const allowed = useAuthStore((state) => required.some(state.hasPermission));

  if (!allowed) {
    return (
      <Result
        status="403"
        title={t("Không có quyền truy cập")}
        subTitle={t("Tài khoản của bạn không được cấp quyền sử dụng chức năng này.")}
        extra={
          <Button type="primary" href="/">
            {t("Về trang chủ")}
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
