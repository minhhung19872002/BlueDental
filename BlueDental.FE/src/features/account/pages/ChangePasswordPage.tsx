import { Card, Button, Input, Typography, message, Row, Col } from "antd";
import { LockOutlined, SaveOutlined } from "@ant-design/icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { t } from "@/lib/i18n";

const { Title, Text } = Typography;

const schema = z.object({
  currentPassword: z.string().min(1, "required_current"),
  newPassword: z.string()
    .min(8, "min_length")
    .regex(/[A-Z]/, "need_upper")
    .regex(/[0-9]/, "need_digit")
    .regex(/[^A-Za-z0-9]/, "need_special"),
  confirmPassword: z.string().min(1, "required_confirm"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "mismatch",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

const ERROR_KEY_MAP: Record<string, string> = {
  required_current: "Vui lòng nhập mật khẩu hiện tại",
  min_length:       "Mật khẩu phải có ít nhất 8 ký tự",
  need_upper:       "Mật khẩu phải có ít nhất một chữ hoa",
  need_digit:       "Mật khẩu phải có ít nhất một chữ số",
  need_special:     "Mật khẩu phải có ít nhất một ký tự đặc biệt",
  required_confirm: "Vui lòng nhập lại mật khẩu mới",
  mismatch:         "Mật khẩu nhập lại không khớp",
};

export function ChangePasswordPage() {

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changeMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      message.success(t("Đổi mật khẩu thành công!"));
      reset();
    },
    onError: () => {
      message.error(t("Đổi mật khẩu thất bại"));
    },
  });

  const onSubmit = (data: FormValues) => {
    changeMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const resolveError = (msg: string | undefined): string | undefined => {
    if (!msg) return undefined;
    return ERROR_KEY_MAP[msg] ? t(ERROR_KEY_MAP[msg]) : msg;
  };

  const fieldStyle = { marginBottom: 16 };
  const labelStyle = { fontSize: 13, fontWeight: 500 as const, color: "#374151", display: "block" as const, marginBottom: 6 };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <Title level={4} style={{ margin: 0 }}>{t("Đổi mật khẩu")}</Title>
          <Text type="secondary">{t("Cập nhật mật khẩu để bảo vệ tài khoản của bạn")}</Text>
        </div>
      </div>

      <Row>
        <Col xs={24} sm={18} md={14} lg={10}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "#EBF3FE", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LockOutlined style={{ fontSize: 20, color: "var(--bd-blue)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#1B2A41" }}>{t("Bảo mật tài khoản")}</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>{t("Tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt")}</div>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Mật khẩu hiện tại")} <span style={{ color: "#EF4444" }}>*</span></label>
              <Controller
                name="currentPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Nhập mật khẩu hiện tại")}
                    style={{ height: 40 }}
                    status={errors.currentPassword ? "error" : ""}
                    autoComplete="current-password"
                  />
                )}
              />
              {errors.currentPassword && <Text style={{ color: "#EF4444", fontSize: 12 }}>{resolveError(errors.currentPassword.message)}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Mật khẩu mới")} <span style={{ color: "#EF4444" }}>*</span></label>
              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Nhập mật khẩu mới")}
                    style={{ height: 40 }}
                    status={errors.newPassword ? "error" : ""}
                    autoComplete="new-password"
                  />
                )}
              />
              {errors.newPassword && <Text style={{ color: "#EF4444", fontSize: 12 }}>{resolveError(errors.newPassword.message)}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Xác nhận mật khẩu mới")} <span style={{ color: "#EF4444" }}>*</span></label>
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Nhập lại mật khẩu mới")}
                    style={{ height: 40 }}
                    status={errors.confirmPassword ? "error" : ""}
                    autoComplete="new-password"
                  />
                )}
              />
              {errors.confirmPassword && <Text style={{ color: "#EF4444", fontSize: 12 }}>{resolveError(errors.confirmPassword.message)}</Text>}
            </div>

            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={changeMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ background: "var(--bd-blue)", height: 40, width: "100%", marginTop: 8 }}
            >
              {t("Cập nhật mật khẩu")}
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
