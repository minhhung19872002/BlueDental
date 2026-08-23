import { useEffect, useState, useMemo } from "react";
import { Modal, Form, Input, Select, DatePicker, Row, Col, Button, Radio, Tabs } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { extractApiError } from "@/lib/apiError";
import type { PatientDto } from "../types/patient";
import { t } from "@/lib/i18n";
import { GENDER_BY_CODE } from "../api/patientAdapters";

/** The translator, so helpers below can take it as a parameter. */
type Translate = (vietnamese: string, ...params: (string | number)[]) => string;

function createPatientSchema(t: Translate) {
  return z.object({
    firstName: z.string().min(1, t("Vui lòng nhập họ")),
    lastName: z.string().min(1, t("Vui lòng nhập tên")),
    phone: z.string().regex(/^\d{8,15}$/, t("Số điện thoại không hợp lệ")),
    gender: z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: z.string().optional(),
    email: z.string().email(t("Email không hợp lệ")).optional().or(z.literal("")),
    address: z.string().optional(),
    notes: z.string().optional(),
    medicalHistory: z.string().optional(),
    examReason: z.string().optional(),
    insuranceNumber: z.string().optional(),
    province: z.string().optional(),
    district: z.string().optional(),
    ward: z.string().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof createPatientSchema>>;

interface Props {
  open: boolean;
  patient?: PatientDto | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PatientEditorModal({ open, patient, onClose, onSuccess }: Props) {
  const schema = useMemo(() => createPatientSchema(t), [t]);
  const isEdit = Boolean(patient);
  const [infoTab, setInfoTab] = useState("basic");
  const [sourceType, setSourceType] = useState<string | undefined>();

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
    [sourceType, t],
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      gender: "male",
      dateOfBirth: "",
      email: "",
      address: "",
      notes: "",
      medicalHistory: "",
      examReason: "",
      insuranceNumber: "",
      province: "",
      district: "",
      ward: "",
    },
  });

  useEffect(() => {
    if (open && patient) {
      reset({
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phoneNumber ?? "",
        gender: GENDER_BY_CODE[patient.gender] ?? "other",
        dateOfBirth: patient.dateOfBirth,
        email: patient.email ?? "",
      });
    } else if (open && !patient) {
      reset();
      setInfoTab("basic");
    }
  }, [open, patient, reset]);

  const createMutation = useRegisterPatient();
  const updateMutation = useUpdatePatient(patient?.id ?? "");
  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: FormValues) => {
    try {
      // Address and medical history have no home on the register endpoint, and
      // the branch comes from the signed-in user, so none of them are sent.
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
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
    <Modal
      open={open}
      title={isEdit ? t("Chỉnh sửa thông tin bệnh nhân") : t("Tạo hồ sơ bệnh nhân")}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnHidden
      styles={{ body: { padding: "20px 24px" } }}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row gutter={24}>
          {/* Column 1 — Contact & Source */}
          <Col span={8}>
            <Row gutter={8}>
              <Col span={8}>
                <Form.Item label={t("Mã")}>
                  <Input placeholder={t("Tự động")} disabled />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label={t("Họ và tên")} required validateStatus={errors.lastName ? "error" : ""} help={errors.lastName?.message}>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => <Input {...field} placeholder={t("Nguyễn Văn A")} />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={t("Số điện thoại")} required validateStatus={errors.phone ? "error" : ""} help={errors.phone?.message}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => <Input {...field} placeholder="09xxxxxxxx" type="tel" />}
              />
            </Form.Item>

            <Form.Item label={t("Chọn loại nguồn đến")}>
              <Select
                placeholder={t("Chọn nguồn")}
                allowClear
                style={{ width: "100%" }}
                value={sourceType}
                onChange={(v) => { setSourceType(v); }}
                options={[
                  { value: "walk_in", label: t("Vãng lai tự tìm đến") },
                  { value: "referral", label: t("Giới thiệu") },
                  { value: "online", label: t("Online") },
                ]}
              />
            </Form.Item>

            <Form.Item label={t("Kênh kết nối")}>
              <Select
                placeholder={sourceType ? t("Chọn kênh") : t("Chọn nguồn đến trước")}
                allowClear
                disabled={!sourceType}
                style={{ width: "100%" }}
                options={channelOptions}
              />
            </Form.Item>

            <Form.Item label={t("Ngày tạo")}>
              <Input value={dayjs().format("DD/MM/YYYY")} disabled />
            </Form.Item>

            <Form.Item label={t("Lý do đến khám")}>
              <Controller
                name="examReason"
                control={control}
                render={({ field }) => (
                  <Input.TextArea {...field} rows={3} placeholder={t("Lý do khám bệnh...")} maxLength={1000} />
                )}
              />
            </Form.Item>
          </Col>

          {/* Column 2 — Basic info / Medical history (tabbed) */}
          <Col span={8}>
            <Tabs
              activeKey={infoTab}
              onChange={setInfoTab}
              size="small"
              items={[
                {
                  key: "basic",
                  label: t("Thông tin cơ bản"),
                  children: (
                    <>
                      <Form.Item label={t("Giới tính")} validateStatus={errors.gender ? "error" : ""}>
                        <Controller
                          name="gender"
                          control={control}
                          render={({ field }) => (
                            <Radio.Group {...field}>
                              <Radio value="male">{t("Nam")}</Radio>
                              <Radio value="female">{t("Nữ")}</Radio>
                              <Radio value="other">{t("Khác")}</Radio>
                            </Radio.Group>
                          )}
                        />
                      </Form.Item>

                      <Form.Item label={t("Ngày sinh")}>
                        <Controller
                          name="dateOfBirth"
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              style={{ width: "100%" }}
                              format="DD/MM/YYYY"
                              disabledDate={(d) => d && d.isAfter(dayjs())}
                              value={field.value ? dayjs(field.value) : null}
                              onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
                            />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Email" validateStatus={errors.email ? "error" : ""} help={errors.email?.message}>
                        <Controller
                          name="email"
                          control={control}
                          render={({ field }) => <Input {...field} placeholder="email@example.com" />}
                        />
                      </Form.Item>

                      <Form.Item label={t("Ghi chú")}>
                        <Controller
                          name="notes"
                          control={control}
                          render={({ field }) => (
                            <Input.TextArea {...field} rows={3} placeholder={t("Ghi chú thêm...")} />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label={t("Nghề nghiệp")}>
                        <Select placeholder={t("Chọn nghề nghiệp")} allowClear style={{ width: "100%" }}>
                          <Select.Option value="other">{t("Khác")}</Select.Option>
                        </Select>
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: "history",
                  label: t("Tiểu sử bệnh"),
                  children: (
                    <Form.Item label={t("Tiền sử bệnh")}>
                      <Controller
                        name="medicalHistory"
                        control={control}
                        render={({ field }) => (
                          <Input.TextArea {...field} rows={8} placeholder={t("Ghi nhận tiền sử bệnh...")} />
                        )}
                      />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </Col>

          {/* Column 3 — Insurance & Address */}
          <Col span={8}>
            <Form.Item label={t("Số thẻ BHYT")}>
              <Controller
                name="insuranceNumber"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder={t("Số thẻ bảo hiểm y tế")} minLength={10} maxLength={15} />
                )}
              />
            </Form.Item>

            <Form.Item label={t("Quốc gia")}>
              <Input value={t("Việt Nam")} disabled />
            </Form.Item>

            <Form.Item label={t("Số nhà / Đường")}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => <Input {...field} placeholder={t("Địa chỉ...")} />}
              />
            </Form.Item>

            <Form.Item label={t("Tỉnh / Thành phố")}>
              <Controller
                name="province"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("Chọn tỉnh / thành")}
                    style={{ width: "100%" }}
                    filterOption={(input, option) =>
                      (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      { value: "HCM", label: t("TP. Hồ Chí Minh") },
                      { value: "HN", label: t("Hà Nội") },
                      { value: "DN", label: t("Đà Nẵng") },
                    ]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label={t("Quận / Huyện")}>
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("Chọn quận / huyện")}
                    style={{ width: "100%" }}
                    options={[]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label={t("Xã / Phường")}>
              <Controller
                name="ward"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("Chọn xã / phường")}
                    style={{ width: "100%" }}
                    options={[]}
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        {errors.root && (
          <div style={{ color: "#C62828", fontSize: 13, marginBottom: 12 }}>
            {errors.root.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid #E5E7EB" }}>
          <Button onClick={onClose}>{t("Hủy")}</Button>
          <Button type="primary" htmlType="submit" loading={isPending} icon={<span>💾</span>}>
            {isEdit ? t("Lưu thay đổi") : t("Lưu")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
