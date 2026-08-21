import { useEffect } from "react";
import { Modal, Form, Input, Select, DatePicker, Row, Col, Button } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { extractApiError } from "@/lib/apiError";
import type { PatientDto } from "../types/patient";

const schema = z.object({
  firstName: z.string().min(1, "Vui lòng nhập họ"),
  lastName: z.string().min(1, "Vui lòng nhập tên"),
  dateOfBirth: z.string().min(1, "Vui lòng chọn ngày sinh"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(9, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email không hợp lệ").optional().or(z.literal("")),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  patient?: PatientDto | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PatientEditorModal({ open, patient, onClose, onSuccess }: Props) {
  const isEdit = Boolean(patient);

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
      dateOfBirth: "",
      gender: "male",
      phone: "",
      email: "",
      address: "",
      medicalHistory: "",
    },
  });

  useEffect(() => {
    if (open && patient) {
      reset({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email ?? "",
        address: patient.address ?? "",
        medicalHistory: patient.medicalHistory ?? "",
      });
    } else if (open && !patient) {
      reset();
    }
  }, [open, patient, reset]);

  const createMutation = useRegisterPatient();
  const updateMutation = useUpdatePatient(patient?.id ?? "");

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit && patient) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
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
      title={isEdit ? "Chỉnh sửa thông tin bệnh nhân" : "Thêm bệnh nhân mới"}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHide
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Họ"
              required
              validateStatus={errors.firstName ? "error" : ""}
              help={errors.firstName?.message}
            >
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => <Input {...field} placeholder="Nguyễn" />}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Tên"
              required
              validateStatus={errors.lastName ? "error" : ""}
              help={errors.lastName?.message}
            >
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => <Input {...field} placeholder="Văn An" />}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Ngày sinh"
              required
              validateStatus={errors.dateOfBirth ? "error" : ""}
              help={errors.dateOfBirth?.message}
            >
              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) =>
                      field.onChange(d ? d.format("YYYY-MM-DD") : "")
                    }
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Giới tính"
              required
              validateStatus={errors.gender ? "error" : ""}
              help={errors.gender?.message}
            >
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select {...field} style={{ width: "100%" }}>
                    <Select.Option value="male">Nam</Select.Option>
                    <Select.Option value="female">Nữ</Select.Option>
                    <Select.Option value="other">Khác</Select.Option>
                  </Select>
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Số điện thoại"
              required
              validateStatus={errors.phone ? "error" : ""}
              help={errors.phone?.message}
            >
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="0912 345 678" />
                )}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Email"
              validateStatus={errors.email ? "error" : ""}
              help={errors.email?.message}
            >
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="email@example.com" />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Địa chỉ">
          <Controller
            name="address"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="Địa chỉ liên hệ" />
            )}
          />
        </Form.Item>

        <Form.Item label="Tiền sử bệnh">
          <Controller
            name="medicalHistory"
            control={control}
            render={({ field }) => (
              <Input.TextArea {...field} rows={3} placeholder="Ghi chú tiền sử bệnh..." />
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

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={isPending}>
            {isEdit ? "Lưu thay đổi" : "Thêm bệnh nhân"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
