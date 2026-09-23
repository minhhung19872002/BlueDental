import { toast } from "sonner";
import { Card, Button, Input, Typography, Row, Col } from "antd";
import { LockOutlined, SaveOutlined } from "@ant-design/icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";

const { Text } = Typography;

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
  required_current: "Account:ValidationCurrentRequired",
  min_length:       "Account:ValidationMinLength",
  need_upper:       "Account:ValidationNeedUpper",
  need_digit:       "Account:ValidationNeedDigit",
  need_special:     "Account:ValidationNeedSpecial",
  required_confirm: "Account:ValidationConfirmRequired",
  mismatch:         "Account:ValidationPasswordMismatch",
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
      toast.success(t("Account:ChangePasswordSuccess"));
      reset();
    },
    onError: () => {
      toast.error(t("Account:ChangePasswordFailed"));
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
  const labelStyle = { fontSize: 13, fontWeight: 500 as const, color: "var(--bd-sub)", display: "block" as const, marginBottom: 6 };

  return (
    <div className="page-container">
      <PageHeader
        title={t("Account:ChangePasswordTitle")}
        subtitle={t("Account:ChangePasswordSubtitle")}
      />

      <Row>
        <Col xs={24} sm={18} md={14} lg={10}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "var(--bd-blue-pale)", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LockOutlined style={{ fontSize: 20, color: "var(--bd-blue)" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--bd-ink)" }}>{t("Account:SecurityHeading")}</div>
                <div style={{ fontSize: 13, color: "var(--bd-muted)" }}>{t("Account:PasswordHint")}</div>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Account:CurrentPasswordLabel")} <span style={{ color: "var(--bd-red)" }}>*</span></label>
              <Controller
                name="currentPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Account:CurrentPasswordPlaceholder")}
                    style={{ height: 40 }}
                    status={errors.currentPassword ? "error" : ""}
                    autoComplete="current-password"
                  />
                )}
              />
              {errors.currentPassword && <Text style={{ color: "var(--bd-red)", fontSize: 12 }}>{resolveError(errors.currentPassword.message)}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Account:NewPasswordLabel")} <span style={{ color: "var(--bd-red)" }}>*</span></label>
              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Account:NewPasswordPlaceholder")}
                    style={{ height: 40 }}
                    status={errors.newPassword ? "error" : ""}
                    autoComplete="new-password"
                  />
                )}
              />
              {errors.newPassword && <Text style={{ color: "var(--bd-red)", fontSize: 12 }}>{resolveError(errors.newPassword.message)}</Text>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t("Account:ConfirmPasswordLabel")} <span style={{ color: "var(--bd-red)" }}>*</span></label>
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder={t("Account:ConfirmPasswordPlaceholder")}
                    style={{ height: 40 }}
                    status={errors.confirmPassword ? "error" : ""}
                    autoComplete="new-password"
                  />
                )}
              />
              {errors.confirmPassword && <Text style={{ color: "var(--bd-red)", fontSize: 12 }}>{resolveError(errors.confirmPassword.message)}</Text>}
            </div>

            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={changeMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ background: "var(--bd-blue)", height: 40, width: "100%", marginTop: 8 }}
            >
              {t("Account:UpdatePasswordButton")}
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
