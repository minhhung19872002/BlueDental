import { LoginForm } from "../components/LoginForm";
import { t } from "@/lib/i18n";

/**
 * Headline figures from the design's splash panel. They are brand copy, not
 * readings from this installation — swap them for real numbers if the panel
 * should ever report the live system.
 */
const HIGHLIGHTS = [
  { value: "12.400+", label: "HỒ SƠ BỆNH NHÂN" },
  { value: "6", label: "CHI NHÁNH" },
  { value: "99,9%", label: "UPTIME" },
];

export function LoginPage() {
  return (
    <div className="login-page">
      <aside className="login-aside">
        <div className="login-brand">
          <img src="/logo.png" alt="BlueDental" className="login-brand-mark" />
          <div>
            <div className="login-brand-name">BlueDental</div>
            <div className="login-brand-sub">
              {t("Auth:AppTagline")}
            </div>
          </div>
        </div>

        <div className="login-aside-body">
          <h1 className="login-aside-title">
            {t("Auth:HeroHeadline1")}
            <br />
            {t("Auth:HeroHeadline2")}
          </h1>
          <p className="login-aside-lead">
            {t("Auth:HeroLead")}
          </p>
          <div className="login-stats">
            {HIGHLIGHTS.map((item) => (
              <div key={item.label}>
                <div className="login-stat-value">{item.value}</div>
                <div className="login-stat-label">{t(item.label)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-aside-foot">
          © {new Date().getFullYear()} {t("Auth:Copyright")}
        </div>
      </aside>

      <div className="login-panel">
        <div className="login-form">
          <h2 className="login-form-title">{t("Auth:LoginFormTitle")}</h2>
          <p className="login-form-sub">{t("Auth:LoginFormSubtitle")}</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
