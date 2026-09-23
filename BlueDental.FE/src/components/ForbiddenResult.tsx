import { Button, Result } from "antd";

import { t } from "@/lib/i18n";

/** Shown in place of a screen or tab the signed-in user may not open. */
export function ForbiddenResult() {
  return (
    <Result
      status="403"
      title={t("Common:Forbidden")}
      subTitle={t("Common:ForbiddenMessage")}
      extra={
        <Button type="primary" href="/">
          {t("Common:GoHome")}
        </Button>
      }
    />
  );
}
