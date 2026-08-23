import { LoginForm } from "../components/LoginForm";
import { t } from "@/lib/i18n";

export function LoginPage() {
  return (
    <div className="login-page">
      <aside className="login-aside">
        <div>
          <h1 className="login-aside-title">BlueDental</h1>
          <p className="login-aside-lead">
            {t("Phần mềm quản lý phòng khám nha khoa toàn diện — hồ sơ bệnh nhân, lịch hẹn, điều trị và thanh toán trong một hệ thống.")}
          </p>
        </div>
        <div>
          <small style={{ color: "#90CAF9" }}>
            © {new Date().getFullYear()} {t("BlueDental. Bảo lưu mọi quyền.")}
          </small>
        </div>
      </aside>

      <div className="login-panel">
        <div className="login-form">
          <h2 className="login-form-title">{t("Đăng nhập")}</h2>
          <p className="login-form-sub">{t("Nhập thông tin tài khoản để tiếp tục")}</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
