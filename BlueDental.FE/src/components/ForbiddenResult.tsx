import { Button, Result } from "antd";

import { t } from "@/lib/i18n";

/** Shown in place of a screen or tab the signed-in user may not open. */
export function ForbiddenResult() {
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
