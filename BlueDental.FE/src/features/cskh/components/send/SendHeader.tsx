import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

/**
 * "Chăm sóc khách hàng / Gửi tin nhắn". The BA's big title and subtitle stay
 * off screen as every page's do (R-993); the one-channel rule moves under the
 * channel cards.
 */
export function SendHeader({ carePath }: { carePath: string }) {
  return (
    <div className="tpe-head">
      <nav className="tpe-crumbs" aria-label={t("CSKH:PageTitle")}>
        <Link className="tpe-crumb" to={carePath}>
          {t("CSKH:PageTitle")}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t("CSKH:Send:PageTitle")}</span>
      </nav>
      <PageHeader title={t("CSKH:Send:PageTitle")} />
    </div>
  );
}
