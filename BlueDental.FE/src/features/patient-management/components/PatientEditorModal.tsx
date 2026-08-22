import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, DatePicker, Row, Col, Button, Radio, Tabs } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { Patient } from "../types/patient";

/**
 * The form shows one "Họ và tên" field, as the reference does, while the API
 * keeps họ (lastName) and tên (firstName) apart. Requiring two schema fields for
 * one input made the form impossible to submit, so the name is captured whole
 * and split on the way out.
 */
function splitVietnameseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  // Vietnamese order puts the given name last; everything before it is họ + đệm.
  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" "),
  };
}

const schema = z.object({
  fullName: z.string().min(1, "Vui lòng nhập họ và tên"),
  phone: z.string().regex(/^\d{8,15}$/, "Số điện thoại không hợp lệ"),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.string().min(1, "Vui lòng chọn ngày sinh"),
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
  patient?: Patient | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PatientEditorModal({ open, patient, onClose, onSuccess }: Props) {
  const isEdit = Boolean(patient);
  const branchId = useCurrentBranchId();
  const [infoTab, setInfoTab] = useState("basic");

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
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
        fullName: [patient.lastName, patient.firstName].filter(Boolean).join(" ").trim(),
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
      const { firstName, lastName } = splitVietnameseName(values.fullName);
      const payload = {
        firstName,
        lastName,
        phoneNumber: values.phone,
        gender: values.gender ?? "male",
        dateOfBirth: values.dateOfBirth,
        email: values.email || undefined,
        nationalId: values.insuranceNumber || undefined,
        branchId,
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
      title={isEdit ? "Chỉnh sửa thông tin bệnh nhân" : "Tạo hồ sơ bệnh nhân"}
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
                <Form.Item label="Mã KH">
                  <Input placeholder="Tự động" disabled />
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="Họ và tên" required validateStatus={errors.fullName ? "error" : ""} help={errors.fullName?.message}>
                  <Controller
                    name="fullName"
                    control={control}
                    render={({ field }) => <Input {...field} placeholder="Nguyễn Văn An" />}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Điện thoại" required validateStatus={errors.phone ? "error" : ""} help={errors.phone?.message}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => <Input {...field} placeholder="09xxxxxxxx" type="tel" />}
              />
            </Form.Item>

            <Form.Item label="Chọn loại nguồn đến">
              <Select placeholder="Chọn nguồn" allowClear style={{ width: "100%" }}>
                <Select.Option value="walk_in">Vãng lai tự tìm đến</Select.Option>
                <Select.Option value="referral">Giới thiệu</Select.Option>
                <Select.Option value="online">Online</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Kênh kết nối">
              <Select placeholder="Chọn kênh" allowClear disabled style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item label="Ngày tạo">
              <Input value={dayjs().format("DD/MM/YYYY")} disabled />
            </Form.Item>

            <Form.Item label="Lý do đến khám">
              <Controller
                name="examReason"
                control={control}
                render={({ field }) => (
                  <Input.TextArea {...field} rows={3} placeholder="Lý do khám bệnh..." maxLength={1000} />
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
                  label: "Thông tin cơ bản",
                  children: (
                    <>
                      <Form.Item label="Giới tính" validateStatus={errors.gender ? "error" : ""}>
                        <Controller
                          name="gender"
                          control={control}
                          render={({ field }) => (
                            <Radio.Group {...field}>
                              <Radio value="male">Nam</Radio>
                              <Radio value="female">Nữ</Radio>
                              <Radio value="other">Khác</Radio>
                            </Radio.Group>
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Ngày sinh">
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

                      <Form.Item label="Ghi chú">
                        <Controller
                          name="notes"
                          control={control}
                          render={({ field }) => (
                            <Input.TextArea {...field} rows={3} placeholder="Ghi chú thêm..." />
                          )}
                        />
                      </Form.Item>

                      <Form.Item label="Nghề nghiệp">
                        <Select placeholder="Chọn nghề nghiệp" allowClear style={{ width: "100%" }}>
                          <Select.Option value="other">Khác</Select.Option>
                        </Select>
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: "history",
                  label: "Tiểu sử bệnh",
                  children: (
                    <Form.Item label="Tiểu sử bệnh">
                      <Controller
                        name="medicalHistory"
                        control={control}
                        render={({ field }) => (
                          <Input.TextArea {...field} rows={8} placeholder="Ghi nhận tiền sử bệnh..." />
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
            <Form.Item label="Số thẻ BHYT">
              <Controller
                name="insuranceNumber"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Số thẻ bảo hiểm y tế" minLength={10} maxLength={15} />
                )}
              />
            </Form.Item>

            <Form.Item label="Quốc gia">
              <Input value="Việt Nam" disabled />
            </Form.Item>

            <Form.Item label="Số nhà / Đường">
              <Controller
                name="address"
                control={control}
                render={({ field }) => <Input {...field} placeholder="Địa chỉ..." />}
              />
            </Form.Item>

            <Form.Item label="Tỉnh / Thành phố">
              <Controller
                name="province"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder="Chọn tỉnh / thành"
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

            <Form.Item label="Quận / Huyện">
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder="Chọn quận / huyện"
                    style={{ width: "100%" }}
                    options={[]}
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Xã / Phường">
              <Controller
                name="ward"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    showSearch
                    allowClear
                    placeholder="Chọn xã / phường"
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
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={isPending} icon={<span>💾</span>}>
            {isEdit ? "Lưu thay đổi" : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
