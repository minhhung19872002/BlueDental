import { Lock, Save, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/features/auth/api";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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
      toast.success(t("Đổi mật khẩu thành công!"));
      reset();
    },
    onError: () => {
      toast.error(t("Đổi mật khẩu thất bại"));
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

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h4 className="text-lg font-semibold">{t("Đổi mật khẩu")}</h4>
          <p className="text-sm text-muted-foreground">{t("Cập nhật mật khẩu để bảo vệ tài khoản của bạn")}</p>
        </div>
      </div>

      <div className="max-w-lg">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-blue-50">
                <Lock size={20} color="#2671D8" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{t("Bảo mật tài khoản")}</div>
                <div className="text-xs text-muted-foreground">{t("Tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt")}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{t("Mật khẩu hiện tại")} <span className="text-destructive">*</span></label>
                <Controller
                  name="currentPassword"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="password"
                      placeholder={t("Nhập mật khẩu hiện tại")}
                      className="h-10"
                      autoComplete="current-password"
                    />
                  )}
                />
                {errors.currentPassword && <p className="mt-1 text-xs text-destructive">{resolveError(errors.currentPassword.message)}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{t("Mật khẩu mới")} <span className="text-destructive">*</span></label>
                <Controller
                  name="newPassword"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="password"
                      placeholder={t("Nhập mật khẩu mới")}
                      className="h-10"
                      autoComplete="new-password"
                    />
                  )}
                />
                {errors.newPassword && <p className="mt-1 text-xs text-destructive">{resolveError(errors.newPassword.message)}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{t("Xác nhận mật khẩu mới")} <span className="text-destructive">*</span></label>
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="password"
                      placeholder={t("Nhập lại mật khẩu mới")}
                      className="h-10"
                      autoComplete="new-password"
                    />
                  )}
                />
                {errors.confirmPassword && <p className="mt-1 text-xs text-destructive">{resolveError(errors.confirmPassword.message)}</p>}
              </div>

              <Button
                className="mt-2 h-10 w-full"
                disabled={changeMutation.isPending}
                onClick={handleSubmit(onSubmit)}
              >
                {changeMutation.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
                {t("Cập nhật mật khẩu")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
