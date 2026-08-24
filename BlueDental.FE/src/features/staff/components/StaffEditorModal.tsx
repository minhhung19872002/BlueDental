import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, EyeOff, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/SearchSelect";
import type { StaffDto } from "../api/staffApi";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export interface StaffFormValues {
  userName: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  phoneNumber: string;
  roleNames: string[];
  branchIds: string[];
  address: string;
  provinceId: string;
  wardId: string;
  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;
  isActive: boolean;
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
}

interface Props {
  open: boolean;
  staff: StaffDto | null;
  roleNames: string[];
  branchOptions: { value: string; label: string }[];
  loading: boolean;
  onSubmit: (values: StaffFormValues, avatarFile?: File | null | undefined) => void;
  onClose: () => void;
}

const EMPTY: StaffFormValues = {
  userName: "",
  password: "",
  confirmPassword: "",
  name: "",
  email: "",
  phoneNumber: "",
  roleNames: [],
  branchIds: [],
  address: "",
  provinceId: "",
  wardId: "",
  isDentist: false,
  isAssistant: false,
  isHygienist: false,
  isActive: true,
  morningStartTime: "08:00",
  morningEndTime: "12:00",
  afternoonStartTime: "13:00",
  afternoonEndTime: "17:00",
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_REGEX = /^0\d{9}$/;

function buildSchema(isEditing: boolean) {
  return z
    .object({
      roleNames: z.array(z.string()).min(1, t("Vui lòng chọn nhóm quyền")),
      branchIds: z.array(z.string()).min(1, t("Vui lòng chọn chi nhánh")),
      name: z.string().min(1, t("Vui lòng nhập họ và tên")),
      email: z.string().min(1, t("Email không được để trống")).email(t("Email không hợp lệ")),
      phoneNumber: z
        .string()
        .refine((v) => !v || PHONE_REGEX.test(v), t("Số điện thoại không hợp lệ (VD: 0901234567)")),
      password: isEditing
        ? z.string()
        : z.string().min(1, t("Mật khẩu không được để trống")),
      confirmPassword: isEditing
        ? z.string()
        : z.string().min(1, t("Vui lòng nhập lại mật khẩu")),
      morningStartTime: z.string().regex(TIME_REGEX, t("Giờ không hợp lệ")),
      morningEndTime: z.string().regex(TIME_REGEX, t("Giờ không hợp lệ")),
      afternoonStartTime: z.string().regex(TIME_REGEX, t("Giờ không hợp lệ")),
      afternoonEndTime: z.string().regex(TIME_REGEX, t("Giờ không hợp lệ")),
    })
    .refine(
      (data) => !data.password || data.password === data.confirmPassword,
      { message: t("Mật khẩu không khớp"), path: ["confirmPassword"] },
    )
    .refine(
      (data) => data.morningStartTime < data.morningEndTime,
      { message: t("Giờ ra phải sau giờ vào"), path: ["morningEndTime"] },
    )
    .refine(
      (data) => data.afternoonStartTime < data.afternoonEndTime,
      { message: t("Giờ ra phải sau giờ vào"), path: ["afternoonEndTime"] },
    );
}

type FieldErrors = Partial<Record<string, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </p>
  );
}

function FloatingPasswordInput({
  label,
  value,
  required,
  error,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  const hasValue = value !== "";

  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder=" "
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "peer h-10 w-full min-w-0 rounded-lg border bg-transparent px-3 pr-10 text-sm shadow-xs transition-[color,box-shadow] outline-none",
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-[3px] focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          )}
        />
        <label
          className={cn(
            "pointer-events-none absolute left-2.5 bg-white px-1 transition-all duration-150 dark:bg-background",
            "top-1/2 -translate-y-1/2 text-sm",
            "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs",
            hasValue && "top-0 -translate-y-1/2 text-xs",
            error
              ? "text-destructive peer-focus:text-destructive"
              : "text-muted-foreground peer-focus:text-primary",
          )}
        >
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function StaffEditorModal({
  open,
  staff,
  roleNames,
  branchOptions,
  loading,
  onSubmit,
  onClose,
}: Props) {
  const [form, setForm] = useState<StaffFormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(staff);

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);

  useEffect(() => {
    getAllProvinces().then(setProvinces);
  }, []);

  const loadWards = useCallback((provinceCode: string) => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    getWardsByProvince(provinceCode).then(setWards);
  }, []);

  useEffect(() => {
    if (open) {
      if (staff) {
        setForm({
          ...EMPTY,
          userName: staff.userName,
          name: staff.fullName || staff.name || "",
          email: staff.email ?? "",
          phoneNumber: staff.phoneNumber ?? "",
          roleNames: staff.roleNames,
          branchIds: staff.branchIds,
          isActive: staff.isActive,
          address: staff.address ?? "",
          provinceId: staff.provinceId ?? "",
          wardId: staff.wardId ?? "",
          isDentist: staff.isDentist,
          isAssistant: staff.isAssistant,
          isHygienist: staff.isHygienist,
          morningStartTime: staff.morningStartTime ?? "08:00",
          morningEndTime: staff.morningEndTime ?? "12:00",
          afternoonStartTime: staff.afternoonStartTime ?? "13:00",
          afternoonEndTime: staff.afternoonEndTime ?? "17:00",
        });
        if (staff.provinceId) loadWards(staff.provinceId);
        else setWards([]);
      } else {
        setForm(EMPTY);
        setWards([]);
      }
      setErrors({});
      setAvatarFile(undefined);
      setAvatarPreview(staff?.avatarUrl ?? null);
    }
  }, [open, staff, loadWards]);

  const setField = <K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const schema = buildSchema(isEditing);
    const result = schema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(form, avatarFile);
  };

  const roleOptions = roleNames.map((r) => ({ value: r, label: r }));
  const provinceOptions = provinces.map((p) => ({ value: p.code, label: p.name }));
  const wardOptions = wards.map((w) => ({ value: w.code, label: w.name }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-none max-md:h-screen max-md:max-h-screen max-md:w-screen max-md:rounded-none"
        style={{ width: 772, maxHeight: "calc(100vh - 32px)", minHeight: 0 }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-2xl!">
            {isEditing ? t("Cập nhật nhân viên") : t("Thêm nhân viên")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            {/* Avatar upload */}
            <div className="flex flex-col items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setAvatarFile(file);
                  const url = URL.createObjectURL(file);
                  setAvatarPreview((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return url; });
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="relative flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-[#F3F4F6] transition-colors hover:bg-[#E5E7EB]"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="size-full object-cover" />
                ) : (
                  <svg
                    className="size-12 text-[#9CA3AF]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#6B7280] transition-colors hover:bg-[#F9FAFB]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  {t("Tải ảnh lên")}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/5"
                    onClick={() => {
                      if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    {t("Xóa ảnh")}
                  </button>
                )}
              </div>
            </div>

            {/* Row: Nhóm quyền + Chi nhánh */}
            <div className="grid grid-cols-2 items-start gap-4">
              <div>
                <SearchSelect
                  value={form.roleNames[0]}
                  options={roleOptions}
                  placeholder={t("Chọn nhóm quyền")}
                  required
                  status={errors.roleNames ? "error" : ""}
                  inline
                  onChange={(v) => setField("roleNames", v ? [v] : [])}
                />
                <FieldError message={errors.roleNames} />
              </div>
              <div>
                <SearchSelect
                  value={form.branchIds[0]}
                  options={branchOptions}
                  placeholder={t("Chọn chi nhánh")}
                  required
                  status={errors.branchIds ? "error" : ""}
                  inline
                  onChange={(v) => setField("branchIds", v ? [v] : [])}
                />
                <FieldError message={errors.branchIds} />
              </div>
            </div>

            {/* Row: Họ và tên + Email + Số điện thoại */}
            <div className="grid grid-cols-3 items-start gap-4">
              <div>
                <FloatingInput
                  label={t("Họ và tên")}
                  value={form.name}
                  required
                  aria-invalid={Boolean(errors.name)}
                  onChange={(e) => setField("name", e.target.value)}
                />
                <FieldError message={errors.name} />
              </div>
              <div>
                <FloatingInput
                  label="Email"
                  type="email"
                  value={form.email}
                  required
                  aria-invalid={Boolean(errors.email)}
                  onChange={(e) => setField("email", e.target.value)}
                />
                <FieldError message={errors.email} />
              </div>
              <div>
                <FloatingInput
                  label={t("Số điện thoại")}
                  value={form.phoneNumber}
                  aria-invalid={Boolean(errors.phoneNumber)}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                />
                <FieldError message={errors.phoneNumber} />
              </div>
            </div>

            {/* Row: Mật khẩu + Nhập lại mật khẩu */}
            <div className="grid grid-cols-2 items-start gap-4">
              <FloatingPasswordInput
                label={t("Mật khẩu")}
                value={form.password}
                required={!isEditing}
                error={errors.password}
                onChange={(v) => setField("password", v)}
              />
              <FloatingPasswordInput
                label={t("Nhập lại mật khẩu")}
                value={form.confirmPassword}
                required={!isEditing}
                error={errors.confirmPassword}
                onChange={(v) => setField("confirmPassword", v)}
              />
            </div>

            {/* Row: Tỉnh/Thành phố + Xã/Phường */}
            <div className="grid grid-cols-2 gap-4">
              <SearchSelect
                value={form.provinceId || undefined}
                options={provinceOptions}
                placeholder={t("Tỉnh/ Thành phố")}
                inline
                onChange={(v) => {
                  setField("provinceId", v ?? "");
                  setField("wardId", "");
                  loadWards(v ?? "");
                }}
              />
              <SearchSelect
                value={form.wardId || undefined}
                options={wardOptions}
                placeholder={t("Xã/ Phường")}
                inline
                disabled={!form.provinceId}
                onChange={(v) => setField("wardId", v ?? "")}
              />
            </div>

            {/* Địa chỉ */}
            <FloatingInput
              label={t("Địa chỉ")}
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
            />

            {/* Row: Working hours - 4 time inputs */}
            <div className="grid grid-cols-4 items-start gap-4">
              <div>
                <FloatingInput
                  label={t("Buổi sáng: giờ vào")}
                  type="time"
                  value={form.morningStartTime}
                  required
                  aria-invalid={Boolean(errors.morningStartTime)}
                  onChange={(e) => setField("morningStartTime", e.target.value)}
                />
                <FieldError message={errors.morningStartTime} />
              </div>
              <div>
                <FloatingInput
                  label={t("Buổi sáng: giờ ra")}
                  type="time"
                  value={form.morningEndTime}
                  required
                  aria-invalid={Boolean(errors.morningEndTime)}
                  onChange={(e) => setField("morningEndTime", e.target.value)}
                />
                <FieldError message={errors.morningEndTime} />
              </div>
              <div>
                <FloatingInput
                  label={t("Buổi chiều: giờ vào")}
                  type="time"
                  value={form.afternoonStartTime}
                  required
                  aria-invalid={Boolean(errors.afternoonStartTime)}
                  onChange={(e) => setField("afternoonStartTime", e.target.value)}
                />
                <FieldError message={errors.afternoonStartTime} />
              </div>
              <div>
                <FloatingInput
                  label={t("Buổi chiều: giờ ra")}
                  type="time"
                  value={form.afternoonEndTime}
                  required
                  aria-invalid={Boolean(errors.afternoonEndTime)}
                  onChange={(e) => setField("afternoonEndTime", e.target.value)}
                />
                <FieldError message={errors.afternoonEndTime} />
              </div>
            </div>

            {/* Role checkboxes */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isDentist"
                  checked={form.isDentist}
                  onCheckedChange={(v) => setField("isDentist", v === true)}
                />
                <Label htmlFor="isDentist" className="text-sm text-[#374151]">
                  {t("Bác sĩ")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isAssistant"
                  checked={form.isAssistant}
                  onCheckedChange={(v) => setField("isAssistant", v === true)}
                />
                <Label htmlFor="isAssistant" className="text-sm text-[#374151]">
                  {t("Phụ tá")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isHygienist"
                  checked={form.isHygienist}
                  onCheckedChange={(v) => setField("isHygienist", v === true)}
                />
                <Label htmlFor="isHygienist" className="text-sm text-[#374151]">
                  {t("Y sĩ")}
                </Label>
              </div>
            </div>

            {/* Work status radio */}
            <div>
              <label className="mb-2 block text-sm text-[#6B7280]">
                {t("Tình trạng làm việc")}
              </label>
              <RadioGroup
                value={form.isActive ? "active" : "resigned"}
                onValueChange={(v) => setField("isActive", v === "active")}
                className="flex items-center gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="active" id="status-active" />
                  <Label htmlFor="status-active" className="text-sm text-[#374151]">
                    {t("Đang làm việc")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="resigned" id="status-resigned" />
                  <Label htmlFor="status-resigned" className="text-sm text-[#374151]">
                    {t("Đã nghỉ")}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            {t("Lưu")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
