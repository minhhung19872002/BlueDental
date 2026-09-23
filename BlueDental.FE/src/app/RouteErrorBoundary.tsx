import { Button, Result, Space } from "antd";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { t } from "@/lib/i18n";

const NOT_FOUND_STATUS = 404;

function reloadPage() {
  window.location.reload();
}

export function RouteErrorBoundary() {
  const error = useRouteError();

  console.error("[BlueDental] Lỗi điều hướng:", error);

  const recoveryActions = (
    <Space>
      <Button type="primary" onClick={reloadPage}>
        {t("Common:Reload")}
      </Button>
      <Button href="/">{t("Common:GoHome")}</Button>
    </Space>
  );

  let content: React.ReactNode;

  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    content = (
      <Result
        status="404"
        title={t("Common:NotFound")}
        subTitle={t("Common:NotFoundMessage")}
        extra={recoveryActions}
      />
    );
  } else if (isRouteErrorResponse(error)) {
    content = (
      <Result
        status="error"
        title={t("Common:PageError")}
        subTitle={t("Common:PageErrorMessage", error.status)}
        extra={recoveryActions}
      />
    );
  } else {
    content = (
      <Result
        status="500"
        title={t("Common:UnexpectedError")}
        subTitle={t("Common:UnexpectedErrorMessage")}
        extra={recoveryActions}
      />
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      {content}
    </div>
  );
}
