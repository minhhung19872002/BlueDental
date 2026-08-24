import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { brand } from "@/theme/index";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const LOGIN_ERROR_MESSAGES: Record<string, () => string> = {
  InvalidUserNameOrPassword: () => t("Tên đăng nhập hoặc mật khẩu không đúng"),
  LoginIsNotAllowed: () => t("Tài khoản chưa được phép đăng nhập"),
  LockedOut: () => t("Tài khoản đã bị khóa, vui lòng thử lại sau"),
};

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
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(buildLoginSchema()),
    defaultValues: { userNameOrEmailAddress: "", password: "", rememberMe: false },
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      if (result.result !== 1) {
        setError("root", {
          message:
            LOGIN_ERROR_MESSAGES[result.description]?.() ||
            t("Đăng nhập không thành công"),
        });
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
      {/* Username field */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="userNameOrEmailAddress">
          {t("Tài khoản")}
        </label>
        <Controller
          name="userNameOrEmailAddress"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="userNameOrEmailAddress"
              placeholder={t("Tên đăng nhập hoặc email")}
              autoComplete="username"
              className={errors.userNameOrEmailAddress ? "border-destructive" : ""}
            />
          )}
        />
        {errors.userNameOrEmailAddress && (
          <p className="text-xs text-destructive">{errors.userNameOrEmailAddress.message}</p>
        )}
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-1 mt-3">
        <label className="text-sm font-medium" htmlFor="password">
          {t("Mật khẩu")}
        </label>
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <div className="relative">
              <Input
                {...field}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("Mật khẩu")}
                autoComplete="current-password"
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Remember me */}
      <div className="login-remember flex items-center gap-2 mt-3">
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="rememberMe"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <label htmlFor="rememberMe" className="text-sm cursor-pointer select-none">
          {t("Ghi nhớ đăng nhập")}
        </label>
      </div>

      {errors.root && (
        <div className="mt-3">
          {/* role="alert" so the failure is announced, not just coloured. */}
          <span role="alert" style={{ color: brand.red, fontSize: 13 }}>
            {errors.root.message}
          </span>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full mt-4 login-submit"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending ? t("Đang đăng nhập...") : t("Đăng nhập")}
      </Button>
    </form>
  );
}
