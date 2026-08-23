import { Card, Button, Input, Typography, message, Row, Col } from "antd";
import { LockOutlined, SaveOutlined } from "@ant-design/icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { t } from "@/lib/i18n";

const { Title, Text } = Typography;

const buildSchema = () =>
  z.object({
  currentPassword: z.string().min(1, t("Vui lòng nhập mật khẩu hiện tại")),
  newPassword: z.string()
    .min(8, t("Mật khẩu phải có ít nhất 8 ký tự"))
    .regex(/[A-Z]/, t("Cần ít nhất 1 ký tự hoa"))
    .regex(/[0-9]/, t("Cần ít nhất 1 chữ số"))
    .regex(/[^A-Za-z0-9]/, t("Cần ít nhất 1 ký tự đặc biệt")),
  confirmPassword: z.string().min(1, t("Vui lòng xác nhận mật khẩu")),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: t("Mật khẩu xác nhận không khớp"),
  path: ["confirmPassword"],
});

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function ChangePasswordPage() {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(buildSchema()),
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
      message.error(t("Mật khẩu hiện tại không đúng"));
    },
  });

  const onSubmit = (data: FormValues) => {
    changeMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const fieldStyle = { marginBottom: 16 };
  const labelStyle = { fontSize: 13, fontWeight: 500 as const, color: "#41505f", display: "block" as const, marginBottom: 6 };

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
              <div style={{ background: "#eaf0fa", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LockOutlined style={{ fontSize: 20, color: "#1c3566" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#101c2c" }}>{t("Bảo mật tài khoản")}</div>
                <div style={{ fontSize: 13, color: "#6f7c90" }}>{t("Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, số và ký tự đặc biệt")}</div>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Mật khẩu hiện tại")} <span style={{ color: "#ef4d4d" }}>*</span></label>
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
              {errors.currentPassword && <Text style={{ color: "#ef4d4d", fontSize: 12 }}>{errors.currentPassword.message}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Mật khẩu mới")} <span style={{ color: "#ef4d4d" }}>*</span></label>
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
              {errors.newPassword && <Text style={{ color: "#ef4d4d", fontSize: 12 }}>{errors.newPassword.message}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Xác nhận mật khẩu mới")} <span style={{ color: "#ef4d4d" }}>*</span></label>
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
              {errors.confirmPassword && <Text style={{ color: "#ef4d4d", fontSize: 12 }}>{errors.confirmPassword.message}</Text>}
            </div>

            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={changeMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ background: "#1c3566", height: 40, width: "100%", marginTop: 8 }}
            >
              {t("Cập nhật mật khẩu")}
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
