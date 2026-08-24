import { useState } from "react";
import { Search, Plus, Pencil, Trash2, User, Shield } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useIdentityUserList,
  useIdentityRoleList,
  useCreateIdentityUser,
  useUpdateIdentityUser,
  useDeleteIdentityUser,
  useCreateIdentityRole,
  useDeleteIdentityRole,
  type IdentityUserDto,
  type IdentityRoleDto,
  type CreateIdentityUserDto,
  type UpdateIdentityUserDto,
  type CreateIdentityRoleDto,
} from "../api";

// ── User Modal ─────────────────────────────────────────────────────────────

const userCreateSchema = z.object({
  userName: z.string().min(1, t("Nhập tên đăng nhập")),
  name: z.string().min(1, t("Nhập họ tên")),
  email: z.string().email(t("Nhập email hợp lệ")),
  phoneNumber: z.string().optional(),
  password: z.string().min(8, t("Tối thiểu 8 ký tự")).optional(),
  roleNames: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

type UserFormValues = z.infer<typeof userCreateSchema>;

function UserModal({
  open,
  onClose,
  editingUser,
  roleNames,
}: {
  open: boolean;
  onClose: () => void;
  editingUser: IdentityUserDto | null;
  roleNames: string[];
}) {
  const createMutation = useCreateIdentityUser();
  const updateMutation = useUpdateIdentityUser();
  const isEdit = Boolean(editingUser);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      userName: editingUser?.userName ?? "",
      name: editingUser?.name ?? "",
      email: editingUser?.email ?? "",
      phoneNumber: editingUser?.phoneNumber ?? "",
      password: "",
      roleNames: editingUser?.roleNames ?? [],
      isActive: editingUser?.isActive ?? true,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (values: UserFormValues) => {
    try {
      if (isEdit && editingUser) {
        await updateMutation.mutateAsync({
          id: editingUser.id,
          data: {
            userName: values.userName,
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber,
            roleNames: values.roleNames,
            isActive: values.isActive ?? true,
          } as UpdateIdentityUserDto,
        });
        toast.success(t("Cập nhật người dùng thành công"));
      } else {
        await createMutation.mutateAsync({
          userName: values.userName,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          password: values.password,
          roleNames: values.roleNames,
          isActive: values.isActive ?? true,
        } as CreateIdentityUserDto);
        toast.success(t("Tạo người dùng thành công"));
      }
      reset();
      onClose();
    } catch {
      // error toast handled by interceptor
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Chỉnh sửa người dùng") : t("Tạo người dùng")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Tên đăng nhập")} <span className="text-destructive">*</span></label>
            <Controller name="userName" control={control} render={({ field }) => (
              <Input placeholder="username" disabled={isEdit} {...field} className={errors.userName ? "border-destructive" : ""} />
            )} />
            {errors.userName && <p className="text-xs text-destructive">{errors.userName.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Họ và tên")} <span className="text-destructive">*</span></label>
            <Controller name="name" control={control} render={({ field }) => (
              <Input placeholder={t("Nguyễn Văn A")} {...field} className={errors.name ? "border-destructive" : ""} />
            )} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
            <Controller name="email" control={control} render={({ field }) => (
              <Input placeholder="user@example.com" {...field} className={errors.email ? "border-destructive" : ""} />
            )} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Số điện thoại")}</label>
            <Controller name="phoneNumber" control={control} render={({ field }) => (
              <Input placeholder="0901234567" {...field} />
            )} />
          </div>

          {!isEdit && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Mật khẩu")} <span className="text-destructive">*</span></label>
              <Controller name="password" control={control} render={({ field }) => (
                <Input type="password" placeholder={t("Mật khẩu...")} {...field} className={errors.password ? "border-destructive" : ""} />
              )} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Vai trò")}</label>
            <Controller name="roleNames" control={control} render={({ field }) => (
              <Select
                value={field.value?.[0] ?? ""}
                onValueChange={(v) => field.onChange(v ? [v] : [])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Chọn vai trò...")} />
                </SelectTrigger>
                <SelectContent>
                  {roleNames.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">{t("Trạng thái")}</label>
            <Controller name="isActive" control={control} render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                <span className="text-sm">{field.value ? t("Hoạt động") : t("Vô hiệu")}</span>
              </div>
            )} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("Hủy")}</Button>
          <Button
            disabled={createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {isEdit ? t("Lưu thay đổi") : t("Tạo người dùng")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Role Modal ─────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(1, t("Nhập tên vai trò")),
  isDefault: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

function RoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateIdentityRole();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: "", isDefault: false, isPublic: true },
  });

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = async (values: RoleFormValues) => {
    try {
      await createMutation.mutateAsync(values as CreateIdentityRoleDto);
      toast.success(t("Tạo vai trò thành công"));
      reset();
      onClose();
    } catch {
      // handled
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>{t("Tạo vai trò")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Tên vai trò")} <span className="text-destructive">*</span></label>
            <Controller name="name" control={control} render={({ field }) => (
              <Input placeholder="VD: admin, doctor, receptionist" {...field} className={errors.name ? "border-destructive" : ""} />
            )} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">{t("Mặc định")}</label>
            <Controller name="isDefault" control={control} render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                <span className="text-sm">{field.value ? t("Có") : t("Không")}</span>
              </div>
            )} />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">{t("Công khai")}</label>
            <Controller name="isPublic" control={control} render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
                <span className="text-sm">{field.value ? t("Có") : t("Không")}</span>
              </div>
            )} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("Hủy")}</Button>
          <Button disabled={createMutation.isPending} onClick={handleSubmit(onSubmit)}>
            {t("Tạo vai trò")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<IdentityUserDto | null>(null);

  const { data: usersData, isLoading } = useIdentityUserList({ filter: keyword || undefined });
  const { data: rolesData } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityUser();

  const roleNames = (rolesData?.items ?? []).map((r) => r.name);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa người dùng thành công"));
    } catch {
      toast.error(t("Xóa thất bại"));
    }
  };

  const users = usersData?.items ?? [];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Button
            onClick={() => { setEditingUser(null); setModalOpen(true); }}
          >
            <Plus size={14} className="mr-1" />
            {t("Tạo người dùng")}
          </Button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder={t("Tìm theo tên, email...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Không có người dùng")}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">{t("Tên đăng nhập")}</TableHead>
                  <TableHead>{t("Họ và tên")}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-36">{t("Số điện thoại")}</TableHead>
                  <TableHead>{t("Vai trò")}</TableHead>
                  <TableHead className="w-28">{t("Trạng thái")}</TableHead>
                  <TableHead className="w-28">{t("Ngày tạo")}</TableHead>
                  <TableHead className="w-28">{t("Thao tác")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phoneNumber ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(user.roleNames ?? []).map((r) => (
                          <span key={r} className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{r}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.isActive ? t("Hoạt động") : t("Vô hiệu")}
                      </span>
                    </TableCell>
                    <TableCell>{dayjs(user.creationTime).format("DD/MM/YYYY")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingUser(user); setModalOpen(true); }}
                        >
                          <Pencil size={14} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Xóa người dùng này?")}</AlertDialogTitle>
                              <AlertDialogDescription>{user.userName}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void handleDelete(user.id)}>
                                {t("Xóa")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingUser={editingUser}
        roleNames={roleNames}
      />
    </>
  );
}

// ── Roles Tab ──────────────────────────────────────────────────────────────

function RolesTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, isLoading } = useIdentityRoleList();
  const deleteMutation = useDeleteIdentityRole();

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa vai trò thành công"));
    } catch {
      toast.error(t("Không thể xóa vai trò hệ thống"));
    }
  };

  const roles: IdentityRoleDto[] = data?.items ?? [];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} className="mr-1" />
          {t("Tạo vai trò")}
        </Button>
      </div>
      <div className="reception-card reception-card--content">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : roles.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Không có vai trò")}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Tên vai trò")}</TableHead>
                  <TableHead className="w-28">{t("Mặc định")}</TableHead>
                  <TableHead className="w-28">{t("Hệ thống")}</TableHead>
                  <TableHead className="w-28">{t("Công khai")}</TableHead>
                  <TableHead className="w-28">{t("Thao tác")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>{role.name}</TableCell>
                    <TableCell>
                      {role.isDefault ? (
                        <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{t("Mặc định")}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {role.isStatic ? (
                        <span className="inline-block rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{t("Tĩnh")}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${role.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {role.isPublic ? t("Công khai") : t("Riêng tư")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {role.isStatic ? (
                        <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t("Không thể xóa")}</span>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Xóa vai trò này?")}</AlertDialogTitle>
                              <AlertDialogDescription>{role.name}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void handleDelete(role.id)}>
                                {t("Xóa")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function IdentityAdministrationPage() {
  return (
    <div className="reception-page">
      <PageHeader
        title={t("Người dùng & vai trò")}
        subtitle={t("Tài khoản đăng nhập và phân quyền")}
      />

      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41", marginBottom: 4 }}>
          {t("Quản trị người dùng & vai trò")}
        </div>
        <div style={{ fontSize: 13, color: "#5A6B82" }}>
          {t("Quản lý tài khoản, vai trò và phân quyền trong hệ thống")}
        </div>
      </div>
      <Tabs
        defaultValue="users"
        className="bg-white rounded-xl px-4"
      >
        <TabsList>
          <TabsTrigger value="users">
            <User size={14} className="mr-1" />{t("Người dùng")}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield size={14} className="mr-1" />{t("Vai trò")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
