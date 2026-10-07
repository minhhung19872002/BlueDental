import { Button } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

/**
 * "Khách hàng dưới 16 tuổi. Cần bổ sung người giám hộ trước khi lưu." right
 * under Ngày sinh, with its shortcut into the popup — the BA's mock.
 */
export function GuardianRequiredBanner({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="bd-guardian-banner" role="alert">
      <TeamOutlined className="bd-guardian-banner-icon" aria-hidden />
      <p className="bd-guardian-banner-text">
        <strong>{t("Patient:Guardian:RequiredBannerTitle")}</strong> {t("Patient:Guardian:RequiredBannerBody")}
      </p>
      <Button type="primary" size="small" onClick={onEnter}>
        {t("Patient:Guardian:EnterNow")}
      </Button>
    </div>
  );
}
