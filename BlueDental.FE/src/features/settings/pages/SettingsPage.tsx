import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useClinicInfo, useUpdateClinicInfo, type UpdateClinicInfoDto } from "../api";
import { t, useLanguage, type Language } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time (UTC+7) — TP.HCM / Ha Noi" },
  { value: "Asia/Bangkok", label: "Indochina Time (UTC+7) — Bangkok" },
  { value: "UTC", label: "UTC+0" },
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

const CURRENCY_OPTIONS = [
  { value: "VND", label: "VND" },
  { value: "USD", label: "USD" },
];

function ClinicInfoTab() {
  const { data: clinic, isLoading } = useClinicInfo();
  const updateMutation = useUpdateClinicInfo();
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", address: "", phoneNumber: "", email: "" });

  const openEdit = () => {
    if (clinic) {
      setFormData({
        name: clinic.name ?? "",
        address: clinic.address ?? "",
        phoneNumber: clinic.phoneNumber ?? "",
        email: clinic.email ?? "",
      });
    }
    setEditOpen(true);
  };

  const handleSave = async () => {
    const data: UpdateClinicInfoDto = {
      name: formData.name,
      address: formData.address,
      phoneNumber: formData.phoneNumber,
      email: formData.email,
    };
    await updateMutation.mutateAsync(data);
    toast.success(t("Cập nhật thông tin thành công"));
    setEditOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center pt-10">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-[640px] pt-4 pb-6">
      <div className="mb-4 flex items-center justify-between">
        <h5 className="text-base font-semibold">{t("Thông tin phòng khám")}</h5>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Pencil className="size-4" />
          {t("Chỉnh sửa")}
        </Button>
      </div>

      <div className="rounded-lg border">
        <div className="grid grid-cols-[160px_1fr] border-b">
          <div className="bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">{t("Tên phòng khám")}</div>
          <div className="px-4 py-3 text-sm">{clinic?.name ?? "—"}</div>
        </div>
        <div className="grid grid-cols-[160px_1fr] border-b">
          <div className="bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">{t("Địa chỉ")}</div>
          <div className="px-4 py-3 text-sm">{clinic?.address ?? "—"}</div>
        </div>
        <div className="grid grid-cols-[160px_1fr] border-b">
          <div className="bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">{t("Số điện thoại")}</div>
          <div className="px-4 py-3 text-sm">{clinic?.phoneNumber ?? "—"}</div>
        </div>
        <div className="grid grid-cols-[160px_1fr] border-b">
          <div className="bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">{t("Email")}</div>
          <div className="px-4 py-3 text-sm">{clinic?.email ?? "—"}</div>
        </div>
        <div className="grid grid-cols-[160px_1fr]">
          <div className="bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">{t("Mã chi nhánh")}</div>
          <div className="px-4 py-3 text-sm">{clinic?.code ?? "—"}</div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Sửa thông tin phòng khám")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("Tên phòng khám")} <span className="text-destructive">*</span></label>
              <Input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("Địa chỉ")}</label>
              <Input value={formData.address} onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("Số điện thoại")}</label>
              <Input value={formData.phoneNumber} onChange={(e) => setFormData((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t("Email")}</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("Hủy")}</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="animate-spin" />}
              {t("Lưu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GeneralSettingsTab() {
  const [language, setLanguage] = useLanguage();
  const [timezone, setTimezone] = useState(localStorage.getItem("bd_timezone") ?? "Asia/Ho_Chi_Minh");
  const [currency, setCurrency] = useState(localStorage.getItem("bd_currency") ?? "VND");
  const [dateFormat, setDateFormat] = useState(localStorage.getItem("bd_dateFormat") ?? "DD/MM/YYYY");

  const handleSave = () => {
    localStorage.setItem("bd_timezone", timezone);
    localStorage.setItem("bd_currency", currency);
    localStorage.setItem("bd_dateFormat", dateFormat);
    if (language !== language) {
      setLanguage(language as Language);
    }
    toast.success(t("Lưu cài đặt thành công"));
  };

  return (
    <div className="max-w-[480px] pt-4 pb-6">
      <h5 className="mb-4 text-base font-semibold">{t("Cài đặt chung")}</h5>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("Múi giờ")}</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("Ngôn ngữ mặc định")}</label>
          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("Đơn vị tiền tệ")}</label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("Định dạng ngày tháng")}</label>
          <Input value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="h-10" />
        </div>
        <Button onClick={handleSave}>{t("Lưu")}</Button>
      </div>
    </div>
  );
}

function PermissionsTab() {
  const navigate = useNavigate();

  return (
    <div className="max-w-[480px] pt-4 pb-6">
      <h5 className="mb-2 text-base font-semibold">{t("Phân quyền người dùng & vai trò")}</h5>
      <p className="text-sm text-muted-foreground">{t("Quản lý tài khoản người dùng và vai trò được thực hiện qua module Identity.")}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
          onClick={() => navigate("/identity/users")}
        >
          <User className="size-4" />
          {t("Quản lý người dùng")}
        </button>
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-primary hover:underline"
          onClick={() => navigate("/identity/roles")}
        >
          <User className="size-4" />
          {t("Quản lý vai trò & quyền")}
        </button>
      </div>
      <Separator className="my-4" />
      <p className="text-xs text-muted-foreground">
        {t("* Để phân quyền chi tiết cho từng chức năng, vào")}{" "}
        <button type="button" className="text-primary hover:underline" onClick={() => navigate("/identity/roles")}>
          {t("Quản lý vai trò & quyền")}
        </button>.
      </p>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title={t("Cài đặt")}
        subtitle={t("Tuỳ chọn hiển thị và cấu hình chung")}
      />

      <div className="mb-4 rounded-[10px] border border-border bg-white px-5 py-4">
        <h2 className="text-lg font-bold text-foreground">{t("Cài đặt hệ thống")}</h2>
      </div>

      <div className="rounded-[10px] border border-border bg-white px-5">
        <Tabs defaultValue="clinic">
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="clinic"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t("Thông tin phòng khám")}
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t("Cài đặt chung")}
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t("Phân quyền")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="clinic"><ClinicInfoTab /></TabsContent>
          <TabsContent value="general"><GeneralSettingsTab /></TabsContent>
          <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
