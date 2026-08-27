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
        {t("Tải lại trang")}
      </Button>
      <Button href="/">{t("Về trang chủ")}</Button>
    </Space>
  );

  let content: React.ReactNode;

  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    content = (
      <Result
        status="404"
        title={t("Không tìm thấy trang")}
        subTitle={t("Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.")}
        extra={recoveryActions}
      />
    );
  } else if (isRouteErrorResponse(error)) {
    content = (
      <Result
        status="error"
        title={t("Không mở được trang")}
        subTitle={t("Máy chủ từ chối yêu cầu (mã lỗi {0}). Vui lòng tải lại trang.", error.status)}
        extra={recoveryActions}
      />
    );
  } else {
    content = (
      <Result
        status="500"
        title={t("Đã xảy ra lỗi ngoài dự kiến")}
        subTitle={t("Hệ thống không hiển thị được nội dung của trang này. Vui lòng tải lại trang.")}
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
