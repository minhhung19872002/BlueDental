import { useState } from "react";
import { Pencil, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useUpdateProfile } from "@/features/account/api/accountMutations";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export function AccountProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  const updateProfile = useUpdateProfile();

  const handleSave = () => {
    if (!user) return;
    updateProfile.mutate(
      { name, email },
      {
        onSuccess: (data) => {
          setAuth({ ...user, name: data.name ?? name, email: data.email ?? email });
          toast.success(t("Cập nhật thông tin thành công!"));
          setEditing(false);
        },
        onError: () => {
          toast.error(t("Cập nhật thất bại. Vui lòng thử lại."));
        },
      },
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h4 className="text-lg font-semibold">{t("Thông tin tài khoản")}</h4>
          <p className="text-sm text-muted-foreground">{t("Quản lý thông tin cá nhân của bạn")}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        {/* Avatar card */}
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Avatar className="mb-4 size-24">
              <AvatarImage src={user?.clinicLogoUrl ?? undefined} />
              <AvatarFallback className="bg-primary text-xl font-bold text-white">
                {(user?.name ?? "BD").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h5 className="mb-1 font-semibold">{user?.name}</h5>
            <p className="text-sm text-muted-foreground">{user?.roles?.[0] ?? "Admin"}</p>
            <p className="mt-2 text-xs text-muted-foreground">{user?.clinicName}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {t("Đổi ảnh đại diện")}
            </Button>
          </CardContent>
        </Card>

        {/* Profile info card */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("Thông tin cá nhân")}</CardTitle>
            {editing ? (
              <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
                {t("Lưu thay đổi")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                {t("Chỉnh sửa")}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Họ và tên")}</p>
                {editing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
                ) : (
                  <p className="font-medium">{user?.name ?? "—"}</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Email")}</p>
                {editing ? (
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
                ) : (
                  <p>{user?.email ?? "—"}</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Vai trò")}</p>
                <p>{user?.roles?.[0] ?? "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Chi nhánh")}</p>
                <p>{user?.clinicName ?? "—"}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t("ID tài khoản")}</p>
              <p className="font-mono text-xs text-muted-foreground">{user?.id ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
