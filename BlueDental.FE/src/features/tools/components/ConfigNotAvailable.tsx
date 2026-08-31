import { t } from "@/lib/i18n";

/**
 * The integration-config screens with no endpoint behind them — messaging,
 * e-invoice — used to draw a search box that filtered nothing and buttons that
 * could never run. Until there is an API, they say so.
 */
export function ConfigNotAvailable({ what }: { what: string }) {
  return (
    <div className="reception-card reception-card--content">
      <div className="tools-empty">
        <div className="tools-empty-title">{t("Chưa có cấu hình {0}", what)}</div>
        <p className="tools-empty-body">
          {t("Phần cấu hình này chưa kết nối với hệ thống. Liên hệ quản trị viên để bật tích hợp.")}
        </p>
      </div>
    </div>
  );
}
