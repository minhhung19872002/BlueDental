import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <div className="login-page">
      <aside className="login-aside">
        <div>
          <h1 className="login-aside-title">BlueDental</h1>
          <p className="login-aside-lead">
            Phần mềm quản lý phòng khám nha khoa toàn diện — hồ sơ bệnh nhân,
            lịch hẹn, điều trị và thanh toán trong một hệ thống.
          </p>
        </div>
        <div>
          <small style={{ color: "#90CAF9" }}>
            © {new Date().getFullYear()} BlueDental. Bảo lưu mọi quyền.
          </small>
        </div>
      </aside>

      <div className="login-panel">
        <div className="login-form">
          <h2 className="login-form-title">Đăng nhập</h2>
          <p className="login-form-sub">Nhập thông tin tài khoản để tiếp tục</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
