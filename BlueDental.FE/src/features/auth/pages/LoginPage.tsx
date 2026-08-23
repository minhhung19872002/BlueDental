import { useTranslation } from "react-i18next";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="login-page">
      <aside className="login-aside">
        <div>
          <h1 className="login-aside-title">BlueDental</h1>
          <p className="login-aside-lead">
            {t("auth.appDescription")}
          </p>
        </div>
        <div>
          <small style={{ color: "#90CAF9" }}>
            {t("auth.copyright", { year: new Date().getFullYear() })}
          </small>
        </div>
      </aside>

      <div className="login-panel">
        <div className="login-form">
          <h2 className="login-form-title">{t("auth.login")}</h2>
          <p className="login-form-sub">{t("auth.loginSubtitle")}</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
