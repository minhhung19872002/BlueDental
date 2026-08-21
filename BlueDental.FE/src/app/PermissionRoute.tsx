import type { ReactNode } from "react";
import { Button, Result } from "antd";
import { useAuthStore } from "@/features/auth/store/authStore";

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
        title="Không có quyền truy cập"
        subTitle="Tài khoản của bạn không được cấp quyền sử dụng chức năng này."
        extra={
          <Button type="primary" href="/">
            Về trang chủ
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
