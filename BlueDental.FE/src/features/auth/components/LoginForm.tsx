import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, Input, Button, Checkbox } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { brand } from "@/theme/index";
import type { LoginResponse } from "../types";

/**
 * ABP answers a refused login with `LoginResultType` and its enum name in
 * `description` — "InvalidUserNameOrPassword". That name is not something to
 * show a user, and it is never localized, so the screen says it in its own
 * words. Built per call: t() reads the language that is current now.
 */
const LOGIN_RESULT_MESSAGES: Record<number, () => string> = {
  2: () => t("Tên đăng nhập hoặc mật khẩu không đúng."),
  3: () => t("Tài khoản chưa được phép đăng nhập. Vui lòng liên hệ quản trị viên."),
  4: () => t("Tài khoản đang tạm khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau."),
  5: () => t("Tài khoản cần xác thực hai lớp để đăng nhập."),
};

function loginResultMessage(result: LoginResponse): string {
  if (result.result === 4 && result.lockoutMinutes) {
    return t(
      "Tài khoản đang tạm khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau {0} phút.",
      result.lockoutMinutes,
    );
  }
  return (
    LOGIN_RESULT_MESSAGES[result.result]?.() ??
    t("Đăng nhập không thành công. Vui lòng thử lại.")
  );
}

const buildLoginSchema = () =>
  z.object({
  userNameOrEmailAddress: z.string().min(1, t("Vui lòng nhập tên đăng nhập")),
  password: z.string().min(1, t("Vui lòng nhập mật khẩu")),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(buildLoginSchema()),
    defaultValues: { rememberMe: false },
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      if (result.result !== 1) {
        setError("root", { message: loginResultMessage(result) });
        return;
      }
      const user = await authApi.getCurrentUser();
      setAuth({
        id: user.id,
        name: user.name,
        email: user.email,
        clinicId: user.clinicId,
        clinicName: user.clinicName,
        clinicLogoUrl: user.clinicLogoUrl,
        clinicTagline: user.clinicTagline,
        roles: user.roles,
        permissions: user.permissions,
      });
      // Tiếp nhận is where the app opens — the router's index redirects there
      // too, so signing in should not land somewhere else.
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ??
        "/reception";
      navigate(from, { replace: true });
    },
    onError: (error) => {
      setError("root", { message: extractApiError(error) });
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-fields">
      {/* Form.Item needs an antd Form above it to lay labels out vertically;
          component={false} supplies that context without nesting a form. */}
      <Form layout="vertical" requiredMark={false} component={false}>
      {/* The design labels each field above the box and keeps the box itself
          plain — no icon inside — so the two rows read as one block. */}
      <Form.Item
        label={t("Tài khoản")}
        colon={false}
        validateStatus={errors.userNameOrEmailAddress ? "error" : ""}
        help={errors.userNameOrEmailAddress?.message}
      >
        <Controller
          name="userNameOrEmailAddress"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder={t("Tên đăng nhập hoặc email")}
              size="large"
              autoComplete="username"
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label={t("Mật khẩu")}
        colon={false}
        validateStatus={errors.password ? "error" : ""}
        help={errors.password?.message}
      >
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              placeholder={t("Mật khẩu")}
              size="large"
              autoComplete="current-password"
            />
          )}
        />
      </Form.Item>

      <Form.Item className="login-remember">
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange}>
              {t("Ghi nhớ đăng nhập")}
            </Checkbox>
          )}
        />
      </Form.Item>

      {errors.root && (
        <Form.Item>
          {/* role="alert" so the failure is announced, not just coloured. */}
          <span role="alert" style={{ color: brand.red, fontSize: 13 }}>
            {errors.root.message}
          </span>
        </Form.Item>
      )}

      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        className="login-submit"
        loading={loginMutation.isPending}
      >
        {t("Đăng nhập")}
      </Button>
      </Form>
    </form>
  );
}
