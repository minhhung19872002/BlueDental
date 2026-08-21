import React from "react";
import { Drawer, Form, Input, Select, Button, Space, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateReception } from "../api/receptionMutations";
import type { RefType } from "../types/reception";

const receptionFormSchema = z.object({
  patientName: z.string().min(1, "Vui lòng nhập tên khách hàng"),
  phoneNumber: z
    .string()
    .min(10, "Số điện thoại phải có ít nhất 10 chữ số")
    .regex(/^[0-9+ ]+$/, "Số điện thoại không hợp lệ"),
  doctorId: z.string().min(1, "Vui lòng chọn bác sĩ tiếp nhận"),
  refType: z.enum(["Medical", "Self", "Referral", "Marketing"] as const),
  notes: z.string().optional(),
});

type ReceptionFormValues = z.infer<typeof receptionFormSchema>;

interface DoctorOption {
  id: string;
  name: string;
  title: string;
}

interface ReceptionNewDrawerProps {
  open: boolean;
  doctors: DoctorOption[];
  onClose: () => void;
}

export const ReceptionNewDrawer: React.FC<ReceptionNewDrawerProps> = ({
  open,
  doctors,
  onClose,
}) => {
  const createMutation = useCreateReception();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceptionFormValues>({
    resolver: zodResolver(receptionFormSchema),
    defaultValues: {
      patientName: "",
      phoneNumber: "",
      doctorId: "",
      refType: "Self",
      notes: "",
    },
  });

  const onSubmit = (data: ReceptionFormValues) => {
    createMutation.mutate(
      {
        patientName: data.patientName,
        phoneNumber: data.phoneNumber,
        doctorId: data.doctorId,
        refType: data.refType as RefType,
        notes: data.notes,
        services: ["Khám tư vấn ban đầu"],
      },
      {
        onSuccess: () => {
          message.success("Tạo tiếp nhận khách hàng mới thành công!");
          reset();
          onClose();
        },
        onError: (err) => {
          message.error(err.message || "Tạo tiếp nhận thất bại");
        },
      },
    );
  };

  return (
    <Drawer
      title="Tạo tiếp nhận khách hàng mới"
      width={480}
      open={open}
      onClose={onClose}
      styles={{ body: { paddingBottom: 80 } }}
      footer={
        <div style={{ textAlign: "right" }}>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              style={{ backgroundColor: "#2671D8", borderColor: "#2671D8" }}
            >
              Lưu tiếp nhận
            </Button>
          </Space>
        </div>
      }
    >
      <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
        <Form.Item
          label="Tên khách hàng / Bệnh nhân"
          required
          validateStatus={errors.patientName ? "error" : ""}
          help={errors.patientName?.message}
        >
          <Controller
            name="patientName"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Nhập họ và tên khách hàng"
                height={40}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          required
          validateStatus={errors.phoneNumber ? "error" : ""}
          help={errors.phoneNumber?.message}
        >
          <Controller
            name="phoneNumber"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Nhập số điện thoại liên hệ"
                height={40}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Bác sĩ tiếp nhận"
          required
          validateStatus={errors.doctorId ? "error" : ""}
          help={errors.doctorId?.message}
        >
          <Controller
            name="doctorId"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                placeholder="Chọn bác sĩ khám"
                options={doctors.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.title})`,
                }))}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Nguồn tiếp nhận"
          required
          validateStatus={errors.refType ? "error" : ""}
          help={errors.refType?.message}
        >
          <Controller
            name="refType"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                placeholder="Chọn nguồn khách hàng"
                options={[
                  { value: "Self", label: "Tự đến" },
                  { value: "Medical", label: "Y tế" },
                  { value: "Referral", label: "Người quen giới thiệu" },
                  { value: "Marketing", label: "Kênh Marketing / Quảng cáo" },
                ]}
              />
            )}
          />
        </Form.Item>

        <Form.Item label="Ghi chú tiếp nhận">
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                rows={4}
                placeholder="Nhập nội dung ghi chú hoặc lý do khám..."
              />
            )}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
