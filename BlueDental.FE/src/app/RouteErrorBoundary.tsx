import { Button } from "@/components/ui/button";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { t } from "@/lib/i18n";
import { AlertCircle, FileQuestion, ServerCrash } from "lucide-react";

const NOT_FOUND_STATUS = 404;

function reloadPage() {
  window.location.reload();
}

export function RouteErrorBoundary() {
  const error = useRouteError();

  console.error("[BlueDental] Lỗi điều hướng:", error);

  const recoveryActions = (
    <div className="flex gap-2 justify-center">
      <Button onClick={reloadPage}>
        {t("Tải lại trang")}
      </Button>
      <Button variant="outline" asChild>
        <a href="/">{t("Về trang chủ")}</a>
      </Button>
    </div>
  );

  if (isRouteErrorResponse(error) && error.status === NOT_FOUND_STATUS) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <FileQuestion className="size-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="text-xl font-medium">{t("Không tìm thấy trang")}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.")}
        </p>
        {recoveryActions}
      </div>
    );
  }

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertCircle className="size-16 text-destructive" />
        <p className="text-xl font-medium">{t("Không mở được trang")}</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("Máy chủ từ chối yêu cầu (mã lỗi {0}). Vui lòng tải lại trang.", error.status)}
        </p>
        {recoveryActions}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <ServerCrash className="size-16 text-destructive" />
      <h1 className="text-2xl font-semibold">500</h1>
      <p className="text-xl font-medium">{t("Đã xảy ra lỗi ngoài dự kiến")}</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t("Hệ thống không hiển thị được nội dung của trang này. Vui lòng tải lại trang.")}
      </p>
      {recoveryActions}
    </div>
  );
}
