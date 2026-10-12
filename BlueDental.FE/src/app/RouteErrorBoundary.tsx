import { Button, Result, Space } from "antd";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { t } from "@/lib/i18n";
import { NotFoundPage } from "./NotFoundPage";

const NOT_FOUND_STATUS = 404;

function reloadPage() {
  window.location.reload();
}

/**
 * The router's errorElement: only reached when a route actually throws. Unknown
 * addresses never land here — the catch-all route renders NotFoundPage itself.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return <NotFoundPage fullscreen />;
  }

  console.error("[BlueDental] Lỗi điều hướng:", error);

  const recoveryActions = (
    <Space>
      <Button type="primary" onClick={reloadPage}>
        {t("Common:Reload")}
      </Button>
      <Button href="/">{t("Common:GoHome")}</Button>
    </Space>
  );

  const content = isRouteErrorResponse(error) ? (
    <Result
      status="error"
      title={t("Common:PageError")}
      subTitle={t("Common:PageErrorMessage", error.status)}
      extra={recoveryActions}
    />
  ) : (
    <Result
      status="500"
      title={t("Common:UnexpectedError")}
      subTitle={t("Common:UnexpectedErrorMessage")}
      extra={recoveryActions}
    />
  );

  return <div className="route-result route-result--fullscreen">{content}</div>;
}
