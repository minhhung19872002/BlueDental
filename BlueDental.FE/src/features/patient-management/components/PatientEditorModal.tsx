import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Plus, Save, Search } from "lucide-react";
import { Building2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { extractApiError } from "@/lib/apiError";
import type { PatientDto } from "../types/patient";
import { t } from "@/lib/i18n";
import { GENDER_BY_CODE } from "../api/patientAdapters";

type Translate = (vietnamese: string, ...params: (string | number)[]) => string;

function createPatientSchema(t: Translate) {
  return z.object({
    firstName: z.string().optional(),
    lastName: z.string().min(1, t("Vui lòng nhập họ và tên")),
    phone: z.string().regex(/^\d{8,15}$/, t("Số điện thoại không hợp lệ")),
    gender: z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: z.string().optional(),
    email: z.string().email(t("Email không hợp lệ")).optional().or(z.literal("")),
    address: z.string().optional(),
    notes: z.string().optional(),
    examReason: z.string().optional(),
    insuranceNumber: z.string().optional(),
    province: z.string().optional(),
    district: z.string().optional(),
    ward: z.string().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof createPatientSchema>>;

const MEDICAL_HISTORY_CATEGORIES = [
  {
    key: "respiratory",
    label: "Bệnh Hô Hấp",
    items: ["Lao", "Hen Suyễn", "Bệnh Phổi Tắc Nghẽn Mãn Tính"],
  },
  {
    key: "cancer",
    label: "Bệnh Ung Thư",
    items: ["Ung Thư Gan", "Ung Thư Tuyến Giáp", "Ung Thư Vòm Họng", "Ung Thư Vú", "Ung Thư Dạ Dày", "Ung Thư Trực Tràng", "Ung Thư Phổi"],
  },
  {
    key: "cardiovascular",
    label: "Bệnh Tim Mạch",
    items: ["Cao Huyết Áp", "Nhồi Máu Cơ Tim", "Suy Tim", "Bệnh Van Tim"],
  },
  {
    key: "kidney",
    label: "Bệnh Thận",
    items: ["Suy Thận", "Sỏi Thận", "Viêm Cầu Thận"],
  },
  {
    key: "hypertension",
    label: "Bệnh Huyết Áp",
    items: ["Tăng Huyết Áp", "Hạ Huyết Áp"],
  },
  {
    key: "diabetes",
    label: "Bệnh Đường Huyết",
    items: ["Tiểu Đường Type 1", "Tiểu Đường Type 2", "Tiểu Đường Thai Kỳ"],
  },
  {
    key: "allergy",
    label: "Dị Ứng Thuốc",
    items: ["Penicillin", "Aspirin", "Ibuprofen", "Sulfonamide"],
  },
  {
    key: "other",
    label: "Chưa Ghi Nhận Bất Thường",
    items: [],
  },
];

interface Props {
  open: boolean;
  patient?: PatientDto | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FloatingFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function FloatingField({ label, required, error, icon, children }: FloatingFieldProps) {
  return (
    <div className="floating-field">
      <div className={`floating-field-wrapper ${error ? "floating-field--error" : ""}`}>
        {icon && <span className="floating-field-icon">{icon}</span>}
        {children}
        <span className={`floating-field-label ${icon ? "floating-field-label--with-icon" : ""}`}>
          {label}{required && <span className="floating-field-required">*</span>}
        </span>
      </div>
      {error && <div className="floating-field-error">{error}</div>}
    </div>
  );
}

export function PatientEditorModal({ open, patient, onClose, onSuccess }: Props) {
  const schema = useMemo(() => createPatientSchema(t), []);
  const isEdit = Boolean(patient);
  const [infoTab, setInfoTab] = useState<"basic" | "history">("basic");
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [upperCase, setUpperCase] = useState(false);
  const [checkedConditions, setCheckedConditions] = useState<Set<string>>(new Set());
  const [historySearch, setHistorySearch] = useState<Record<string, string>>({});

  const CHANNEL_MAP: Record<string, { value: string; label: string }[]> = {
    walk_in: [
      { value: "direct", label: t("Trực tiếp đến") },
      { value: "appointment_app", label: t("Đặt lịch qua app") },
      { value: "appointment_web", label: t("Đặt lịch qua website") },
    ],
    referral: [
      { value: "friend", label: t("Bạn bè") },
      { value: "family", label: t("Người thân") },
      { value: "doctor", label: t("Bác sĩ giới thiệu") },
    ],
    online: [
      { value: "facebook", label: "Facebook" },
      { value: "zalo", label: "Zalo" },
      { value: "google", label: "Google" },
      { value: "tiktok", label: "TikTok" },
      { value: "instagram", label: "Instagram" },
      { value: "youtube", label: "YouTube" },
    ],
  };

  const channelOptions = useMemo(
    () => (sourceType ? CHANNEL_MAP[sourceType] ?? [] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceType],
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      gender: "male",
      dateOfBirth: "",
      email: "",
      address: "",
      notes: "",
      examReason: "",
      insuranceNumber: "",
      province: "",
      district: "",
      ward: "",
    },
  });

  const provinceValue = watch("province");
  const districtValue = watch("district");

  useEffect(() => {
    if (open && patient) {
      reset({
        firstName: patient.firstName,
        lastName: [patient.lastName, patient.firstName].filter(Boolean).join(" ").trim(),
        phone: patient.phoneNumber ?? "",
        gender: GENDER_BY_CODE[patient.gender] ?? "other",
        dateOfBirth: patient.dateOfBirth,
        email: patient.email ?? "",
      });
    } else if (open && !patient) {
      reset();
      setInfoTab("basic");
      setSourceType(undefined);
      setUpperCase(false);
      setCheckedConditions(new Set());
      setHistorySearch({});
    }
  }, [open, patient, reset]);

  const createMutation = useRegisterPatient();
  const updateMutation = useUpdatePatient(patient?.id ?? "");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const toggleCondition = (condition: string) => {
    setCheckedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(condition)) next.delete(condition);
      else next.add(condition);
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const nameParts = values.lastName.trim().split(/\s+/);
      const derivedFirstName = values.firstName || (nameParts.length > 1 ? nameParts.pop()! : "");
      const derivedLastName = nameParts.join(" ") || values.lastName.trim();

      const payload = {
        firstName: derivedFirstName,
        lastName: derivedLastName,
        phoneNumber: values.phone,
        gender: values.gender ?? "male",
        dateOfBirth: values.dateOfBirth ?? "",
        email: values.email,
      };
      if (isEdit && patient) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      setError("root", { message: extractApiError(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className="patient-editor-modal"
        style={{ maxWidth: 1100, width: "95vw" }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Chỉnh sửa hồ sơ") : t("Tạo hồ sơ")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="patient-editor-body">
            {/* Column 1 — Contact & Source */}
            <div className="patient-editor-col">
              <FloatingField label={t("Mã khách hàng")}>
                <div className="patient-code-field">
                  <span className="patient-code-prefix">DH26</span>
                  <Input
                    className="patient-code-input"
                    placeholder="013"
                    disabled={isEdit}
                  />
                </div>
              </FloatingField>

              <FloatingField label={t("Họ và tên")} required error={errors.lastName?.message}>
                <Controller
                  name="lastName"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder=" "
                      style={upperCase ? { textTransform: "uppercase" } : undefined}
                    />
                  )}
                />
              </FloatingField>

              <label className="patient-uppercase-check">
                <input
                  type="checkbox"
                  checked={upperCase}
                  onChange={(e) => setUpperCase(e.target.checked)}
                />
                <span>{t("IN HOA")}</span>
              </label>

              <FloatingField label={t("Điện thoại")} required error={errors.phone?.message}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder=" " type="tel" />}
                />
              </FloatingField>

              <div className="patient-source-row">
                <FloatingField label={t("Chọn loại nguồn đến")}>
                  <Select
                    value={sourceType ?? ""}
                    onValueChange={(v) => setSourceType(v || undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder=" " />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in">{t("Vãng lai tự tìm đến")}</SelectItem>
                      <SelectItem value="referral">{t("Giới thiệu")}</SelectItem>
                      <SelectItem value="online">{t("Online")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FloatingField>
                <Button
                  type="button"
                  size="sm"
                  className="patient-source-add-btn rounded-full w-8 h-8 p-0"
                >
                  <Plus size={14} />
                </Button>
              </div>

              <FloatingField label={t("Kênh kết nối")}>
                <Select disabled={!sourceType}>
                  <SelectTrigger>
                    <SelectValue placeholder=" " />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FloatingField>

              <FloatingField label={t("Ngày tạo")}>
                <Input value={dayjs().format("D/M/YYYY")} disabled placeholder=" " />
              </FloatingField>

              <FloatingField label={t("Lý do đến khám")}>
                <Controller
                  name="examReason"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      placeholder=" "
                      maxLength={1000}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  )}
                />
              </FloatingField>
            </div>

            {/* Column 2 — Tabs (Thông tin cơ bản / Tiểu sử bệnh) */}
            <div className="patient-editor-col">
              <div className="patient-editor-tabs">
                <button
                  type="button"
                  className={`patient-editor-tab ${infoTab === "basic" ? "patient-editor-tab--active" : ""}`}
                  onClick={() => setInfoTab("basic")}
                >
                  {t("Thông tin cơ bản")}
                </button>
                <button
                  type="button"
                  className={`patient-editor-tab ${infoTab === "history" ? "patient-editor-tab--active" : ""}`}
                  onClick={() => setInfoTab("history")}
                >
                  {t("Tiểu sử bệnh")}
                </button>
              </div>

              {infoTab === "basic" && (
                <div className="patient-editor-tab-content">
                  <div className="patient-editor-field-group">
                    <span className="patient-editor-field-label">{t("Giới tính")}</span>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <div className="flex items-center gap-4">
                          {(["male", "female", "other"] as const).map((g) => (
                            <label key={g} className="flex items-center gap-1 cursor-pointer text-sm">
                              <input
                                type="radio"
                                value={g}
                                checked={field.value === g}
                                onChange={() => field.onChange(g)}
                              />
                              {g === "male" ? t("Nam") : g === "female" ? t("Nữ") : t("Khác")}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </div>

                  <FloatingField label={t("Ngày sinh")}>
                    <Controller
                      name="dateOfBirth"
                      control={control}
                      render={({ field }) => (
                        <DatePickerInput
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v)}
                          max={dayjs().format("YYYY-MM-DD")}
                        />
                      )}
                    />
                  </FloatingField>

                  <FloatingField label="Email" error={errors.email?.message}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => <Input {...field} placeholder=" " />}
                    />
                  </FloatingField>

                  <FloatingField label={t("Ghi chú")}>
                    <Controller
                      name="notes"
                      control={control}
                      render={({ field }) => (
                        <textarea
                          {...field}
                          rows={4}
                          placeholder=" "
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      )}
                    />
                  </FloatingField>

                  <FloatingField
                    label={t("Nghề nghiệp")}
                    icon={<Building2 size={16} strokeWidth={1.5} color="#9CA3AF" />}
                  >
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder=" " />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doctor">{t("Bác sĩ")}</SelectItem>
                        <SelectItem value="teacher">{t("Giáo viên")}</SelectItem>
                        <SelectItem value="engineer">{t("Kỹ sư")}</SelectItem>
                        <SelectItem value="student">{t("Sinh viên")}</SelectItem>
                        <SelectItem value="worker">{t("Công nhân")}</SelectItem>
                        <SelectItem value="business">{t("Kinh doanh")}</SelectItem>
                        <SelectItem value="retired">{t("Hưu trí")}</SelectItem>
                        <SelectItem value="other">{t("Khác")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FloatingField>
                </div>
              )}

              {infoTab === "history" && (
                <div className="patient-editor-tab-content">
                  <div className="medical-history-title">{t("TIỂU SỬ BỆNH")}</div>
                  <Accordion type="multiple" className="medical-history-collapse">
                    {MEDICAL_HISTORY_CATEGORIES.filter((c) => c.items.length > 0).map((category) => {
                      const searchTerm = historySearch[category.key] ?? "";
                      const filtered = searchTerm
                        ? category.items.filter((item) =>
                            item.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        : category.items;

                      return (
                        <AccordionItem key={category.key} value={category.key}>
                          <AccordionTrigger className="text-sm font-medium py-2">
                            {t(category.label)}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="medical-history-items">
                              {category.items.length > 5 && (
                                <div className="relative mb-2">
                                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    className="pl-7 h-7 text-xs"
                                    placeholder={t("Tìm kiếm...")}
                                    value={searchTerm}
                                    onChange={(e) =>
                                      setHistorySearch((prev) => ({ ...prev, [category.key]: e.target.value }))
                                    }
                                  />
                                </div>
                              )}
                              {filtered.map((item) => (
                                <div key={item} className="flex items-center gap-2 mb-1.5">
                                  <Checkbox
                                    id={`cond-${item}`}
                                    checked={checkedConditions.has(item)}
                                    onCheckedChange={() => toggleCondition(item)}
                                  />
                                  <label htmlFor={`cond-${item}`} className="text-sm cursor-pointer">
                                    {t(item)}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  {MEDICAL_HISTORY_CATEGORIES.filter((c) => c.items.length === 0).map((category) => (
                    <div key={category.key} className="medical-history-no-items">
                      <span style={{ marginRight: 8 }}>▸</span>
                      {t(category.label)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3 — Insurance & Address */}
            <div className="patient-editor-col">
              <FloatingField label={t("Số thẻ BHYT")}>
                <Controller
                  name="insuranceNumber"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder=" " minLength={10} maxLength={15} />
                  )}
                />
              </FloatingField>

              <FloatingField label={t("Quốc gia")}>
                <Select value="VN" disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VN">{t("Việt Nam")}</SelectItem>
                  </SelectContent>
                </Select>
              </FloatingField>

              <FloatingField label={t("Số nhà/ Đường")}>
                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder=" " />}
                />
              </FloatingField>

              <FloatingField label={t("Tỉnh/ Thành phố")}>
                <Controller
                  name="province"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder=" " />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HCM">{t("TP. Hồ Chí Minh")}</SelectItem>
                        <SelectItem value="HN">{t("Hà Nội")}</SelectItem>
                        <SelectItem value="DN">{t("Đà Nẵng")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FloatingField>

              <FloatingField label={t("Quận/ Huyện")}>
                <Controller
                  name="district"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!provinceValue}>
                      <SelectTrigger>
                        <SelectValue placeholder=" " />
                      </SelectTrigger>
                      <SelectContent>
                        {/* populated dynamically */}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FloatingField>

              <FloatingField label={t("Xã/ Phường")}>
                <Controller
                  name="ward"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!districtValue}>
                      <SelectTrigger>
                        <SelectValue placeholder=" " />
                      </SelectTrigger>
                      <SelectContent>
                        {/* populated dynamically */}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FloatingField>
            </div>
          </div>

          {errors.root && (
            <div style={{ color: "#C62828", fontSize: 13, marginBottom: 12 }}>
              {errors.root.message}
            </div>
          )}

          <div className="patient-editor-footer">
            <Button
              type="submit"
              disabled={isPending || (!isValid && !isEdit)}
            >
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
              {t("Lưu")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
