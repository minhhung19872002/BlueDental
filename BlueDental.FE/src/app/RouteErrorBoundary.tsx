import { Button, Result, Space } from "antd";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

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
        Tải lại trang
      </Button>
      <Button href="/">Về trang chủ</Button>
    </Space>
  );

  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return (
      <Result
        status="404"
        title="Không tìm thấy trang"
        subTitle="Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển."
        extra={recoveryActions}
      />
    );
  }

  if (isRouteErrorResponse(error)) {
    return (
      <Result
        status="error"
        title="Không mở được trang"
        subTitle={`Máy chủ từ chối yêu cầu (mã lỗi ${error.status}). Vui lòng tải lại trang.`}
        extra={recoveryActions}
      />
    );
  }

  return (
    <Result
      status="500"
      title="Đã xảy ra lỗi ngoài dự kiến"
      subTitle="Hệ thống không hiển thị được nội dung của trang này. Vui lòng tải lại trang."
      extra={recoveryActions}
    />
  );
}
