import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, Input, Button, Checkbox } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../api";
import { useAuthStore } from "../store/authStore";
import { extractApiError } from "@/lib/apiError";

const loginSchema = z.object({
  userNameOrEmailAddress: z.string().min(1, "Vui lòng nhập tên đăng nhập"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      if (result.result !== 1) {
        setError("root", {
          message: result.description || "Đăng nhập không thành công",
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
      const from =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ??
        "/dashboard";
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Form.Item
        validateStatus={errors.userNameOrEmailAddress ? "error" : ""}
        help={errors.userNameOrEmailAddress?.message}
      >
        <Controller
          name="userNameOrEmailAddress"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              prefix={<UserOutlined />}
              placeholder="Tên đăng nhập hoặc email"
              size="large"
              autoComplete="username"
            />
          )}
        />
      </Form.Item>

      <Form.Item
        validateStatus={errors.password ? "error" : ""}
        help={errors.password?.message}
      >
        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <Input.Password
              {...field}
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
              size="large"
              autoComplete="current-password"
            />
          )}
        />
      </Form.Item>

      <Form.Item>
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={field.onChange}>
              Ghi nhớ đăng nhập
            </Checkbox>
          )}
        />
      </Form.Item>

      {errors.root && (
        <Form.Item>
          <span style={{ color: "#C62828", fontSize: 13 }}>
            {errors.root.message}
          </span>
        </Form.Item>
      )}

      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={loginMutation.isPending}
      >
        Đăng nhập
      </Button>
    </form>
  );
}
