import { useEffect, useState, useMemo } from "react";
import { Modal, Form, Input, Select, DatePicker, Row, Col, Button, Radio, Tabs } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { extractApiError } from "@/lib/apiError";
import type { PatientDto } from "../types/patient";

const schema = z.object({
  firstName: z.string().min(1, "Vui lòng nhập họ"),
  lastName: z.string().min(1, "Vui lòng nhập tên"),
  phone: z.string().regex(/^\d{8,15}$/, "Số điện thoại không hợp lệ"),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  medicalHistory: z.string().optional(),
  examReason: z.string().optional(),
  insuranceNumber: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  patient?: PatientDto | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PatientEditorModal({ open, patient, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const isEdit = Boolean(patient);
  const [infoTab, setInfoTab] = useState("basic");
  const [sourceType, setSourceType] = useState<string | undefined>();

  const CHANNEL_MAP: Record<string, { value: string; label: string }[]> = {
    walk_in: [
      { value: "direct", label: t("patient.channelDirect") },
      { value: "appointment_app", label: t("patient.channelApp") },
      { value: "appointment_web", label: t("patient.channelWeb") },
    ],
    referral: [
      { value: "friend", label: t("patient.channelFriend") },
      { value: "family", label: t("patient.channelFamily") },
      { value: "doctor", label: t("patient.channelDoctor") },
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
        phone: patient.phone,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
        email: patient.email ?? "",
        address: patient.address ?? "",
        medicalHistory: patient.medicalHistory ?? "",
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
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        gender: values.gender ?? "male",
        dateOfBirth: values.dateOfBirth ?? "",
        email: values.email,
        address: values.address,
        medicalHistory: values.medicalHistory,
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
      title={isEdit ? t("patient.editTitle") : t("patient.createTitle")}
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
                <Form.Item label={t("patient.code")}>
                  <Input placeholder={t("patient.codeAuto")} disabled />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label={t("patient.fullName")} required validateStatus={errors.lastName ? "error" : ""} help={errors.lastName?.message}>
                  <Controller
                    name="lastName"
                    control={control}
                    render={({ field }) => <Input {...field} placeholder="Nguyễn Văn An" />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label={t("common.phone")} required validateStatus={errors.phone ? "error" : ""} help={errors.phone?.message}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => <Input {...field} placeholder="09xxxxxxxx" type="tel" />}
              />
            </Form.Item>

            <Form.Item label={t("patient.sourceType")}>
              <Select
                placeholder={t("patient.selectSource")}
                allowClear
                style={{ width: "100%" }}
                value={sourceType}
                onChange={(v) => { setSourceType(v); }}
                options={[
                  { value: "walk_in", label: t("patient.sourceWalkIn") },
                  { value: "referral", label: t("patient.sourceReferral") },
                  { value: "online", label: t("patient.sourceOnline") },
                ]}
              />
            </Form.Item>

            <Form.Item label={t("patient.channel")}>
              <Select
                placeholder={sourceType ? t("patient.selectChannel") : t("patient.selectSourceFirst")}
                allowClear
                disabled={!sourceType}
                style={{ width: "100%" }}
                options={channelOptions}
              />
            </Form.Item>

            <Form.Item label={t("common.createdDate")}>
              <Input value={dayjs().format("DD/MM/YYYY")} disabled />
            </Form.Item>

            <Form.Item label={t("patient.examReason")}>
              <Controller
                name="examReason"
                control={control}
                render={({ field }) => (
                  <Input.TextArea {...field} rows={3} placeholder={t("patient.examReasonPlaceholder")} maxLength={1000} />
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
                  label: t("patient.tabBasic"),
                  children: (
                    <>
                      <Form.Item label={t("patient.gender")} validateStatus={errors.gender ? "error" : ""}>
                        <Controller
                          name="gender"
                          control={control}
                          render={({ field }) => (
                            <Radio.Group {...field}>
                              <Radio value="male">{t("patient.genderMale")}</Radio>
                              <Radio value="female">{t("patient.genderFemale")}</Radio>
                              <Radio value="other">{t("patient.genderOther")}</Radio>
                            </Radio.Group>
                          )}
                        />
                      </Form.Item>

                      <Form.Item label={t("patient.dateOfBirth")}>
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

                      <Form.Item label={t("common.note")}>
                        <Controller
                          name="notes"
                          control={control}
                          render={({ field }) => (
                            <Input.TextArea {...field} rows={3} placeholder={t("common.notePlaceholder")} />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label={t("patient.occupation")}>
                        <Select placeholder={t("patient.selectOccupation")} allowClear style={{ width: "100%" }}>
                          <Select.Option value="other">{t("common.other")}</Select.Option>
                        </Select>
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: "history",
                  label: t("patient.tabHistory"),
                  children: (
                    <Form.Item label={t("patient.medicalHistory")}>
                      <Controller
                        name="medicalHistory"
                        control={control}
                        render={({ field }) => (
                          <Input.TextArea {...field} rows={8} placeholder={t("patient.medicalHistoryPlaceholder")} />
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
            <Form.Item label={t("patient.insuranceNumber")}>
              <Controller
                name="insuranceNumber"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder={t("patient.insuranceNumberPlaceholder")} minLength={10} maxLength={15} />
                )}
              />
            </Form.Item>

            <Form.Item label={t("patient.country")}>
              <Input value="Việt Nam" disabled />
            </Form.Item>

            <Form.Item label={t("patient.streetAddress")}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => <Input {...field} placeholder={t("patient.addressPlaceholder")} />}
              />
            </Form.Item>

            <Form.Item label={t("patient.province")}>
              <Controller
                name="province"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("patient.selectProvince")}
                    style={{ width: "100%" }}
                    filterOption={(input, option) =>
                      (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      { value: "HCM", label: "TP. Hồ Chí Minh" },
                      { value: "HN", label: "Hà Nội" },
                      { value: "DN", label: "Đà Nẵng" },
                    ]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label={t("patient.district")}>
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("patient.selectDistrict")}
                    style={{ width: "100%" }}
                    options={[]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label={t("patient.ward")}>
              <Controller
                name="ward"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder={t("patient.selectWard")}
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
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={isPending} icon={<span>💾</span>}>
            {isEdit ? t("common.saveChanges") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
