import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Pencil, Calendar, FileText, Image, Pill, Phone, DollarSign, History, Plus, Upload } from "lucide-react";
import { usePatient } from "../api/patientQueries";
import { DentalChartView, type ToothRecord } from "../components/DentalChartView";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { useTreatmentPlanList, usePatientPrescriptions } from "@/features/treatment-management/api/index";
import { INVOICE_STATUS, usePatientInvoices } from "@/features/billing/api/index";
import { usePatientLaboOrders } from "@/features/labo/api/laboApi";
import { useCareRecordList } from "@/features/cskh/api/careApi";
import {
  usePatientAdviseSummary,
  usePatientAdvises,
  usePatientDiagnoses,
} from "@/features/treatment-management/api/consultingQueries";
import {
  ADVISE_STATUS,
  formatTeeth,
  type PatientAdviseStatus,
} from "@/features/treatment-management/api/consultingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";





export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);

  const GENDER_LABELS: Record<string, string> = {
    male: t("Nam"),
    female: t("Nữ"),
    other: t("Khác"),
  };

  const ADVISE_STATUS_CONFIG: Record<PatientAdviseStatus, { label: string; color: string }> = {
    [ADVISE_STATUS.Created]:   { label: t("Chờ duyệt"),   color: "#6B7280" },
    [ADVISE_STATUS.Accepted]:  { label: t("Đã chốt"),  color: "#3B82F6" },
    [ADVISE_STATUS.Converted]: { label: t("Đã lên KHĐT"), color: "#10B981" },
    [ADVISE_STATUS.Rejected]:  { label: t("Từ chối"),  color: "#EF4444" },
    [ADVISE_STATUS.Cancelled]: { label: t("Đã hủy"), color: "#6B7280" },
  };

  const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    Scheduled:  { label: t("Đã hẹn"),  color: "#2671D8" },
    Confirmed:  { label: t("Đã xác nhận"),  color: "#3B82F6" },
    CheckedIn:  { label: t("Đã đến"),  color: "#10B981" },
    InProgress: { label: t("Đang khám"), color: "#F97316" },
    Completed:  { label: t("Hoàn thành"),  color: "#10B981" },
    Cancelled:  { label: t("Đã hủy"),  color: "#EF4444" },
    NoShow:     { label: t("Vắng mặt"),     color: "#6B7280" },
  };

  const APPOINTMENT_COUNTER_CARDS = [
    { key: "scheduled", label: t("Đã hẹn"), borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
    { key: "arrived",   label: t("Đã đến"),   borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
    { key: "cancelled", label: t("Đã huỷ"), borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
    { key: "late",      label: t("Trễ hẹn"),      borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  ];

  const activeTab = searchParams.get("tab") ?? "profile";
  const { data: patient, isLoading } = usePatient(id ?? "");

  const { data: appointmentsData } = useAppointmentList({ patientId: id, maxResultCount: 50 });
  const { data: treatmentPlans } = useTreatmentPlanList({ patientId: id });
  const { data: invoices } = usePatientInvoices(id ?? "");
  const { data: laboOrders } = usePatientLaboOrders(id ?? "");
  const { data: careRecords } = useCareRecordList({ patientId: id, maxResultCount: 50 });
  const { data: prescriptions } = usePatientPrescriptions(id ?? "");
  const appointments = appointmentsData?.items ?? [];
  const plans = treatmentPlans?.items ?? [];
  const patientInvoices = invoices ?? [];
  const patientLaboOrders = laboOrders ?? [];
  const patientCareRecords = careRecords?.items ?? [];
  const patientPrescriptions = prescriptions ?? [];

  const branchId = useCurrentBranchId();
  const consultingParams = { patientId: id ?? "", clinicBranchId: branchId, maxResultCount: 50 };
  const { data: diagnosisPage, isLoading: diagnosesLoading } = usePatientDiagnoses(consultingParams);
  const { data: advisePage, isLoading: advisesLoading } = usePatientAdvises(consultingParams);
  const { data: adviseSummary } = usePatientAdviseSummary(consultingParams);

  const diagnosisRows = diagnosisPage?.items ?? [];
  const adviseRows = advisePage?.items ?? [];

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key });
  };

  const handleToothClick = (fdi: number) => {
    setSelectedTeeth((prev) => {
      const exists = prev.find((t) => t.fdi === fdi);
      if (exists) return prev.filter((t) => t.fdi !== fdi);
      return [...prev, { fdi, status: "treated" }];
    });
  };

  if (isLoading) {
    return (
      <div className="grid place-items-center min-h-[300px]">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-3 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/patient")}
          style={{ color: "#2671D8", padding: "0 4px" }}
        >
          <ArrowLeft size={14} className="mr-1" />
          {t("Quay lại")}
        </Button>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span style={{ color: "#1B2A41", fontWeight: 500 }}>
          [{patient.code}] - {patient.fullName}
        </span>
      </div>

      {/* 10 tabs with URL sync */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="profile">{t("Hồ sơ")}</TabsTrigger>
          <TabsTrigger value="consulting">{t("Chẩn đoán & Tư vấn")}</TabsTrigger>
          <TabsTrigger value="treatment-plan" className="flex items-center gap-1">
            <FileText size={14} />{t("Kế hoạch điều trị")}
          </TabsTrigger>
          <TabsTrigger value="appointment" className="flex items-center gap-1">
            <Calendar size={14} />{t("Lịch hẹn")}
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-1">
            <Image size={14} />{t("Hình ảnh")}
          </TabsTrigger>
          <TabsTrigger value="labo">{t("Labo")}</TabsTrigger>
          <TabsTrigger value="prescription" className="flex items-center gap-1">
            <Pill size={14} />{t("Đơn thuốc")}
          </TabsTrigger>
          <TabsTrigger value="care" className="flex items-center gap-1">
            <Phone size={14} />{t("Chăm sóc KH")}
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-1">
            <DollarSign size={14} />{t("Hóa đơn")}
          </TabsTrigger>
          <TabsTrigger value="debt-history" className="flex items-center gap-1">
            <History size={14} />{t("Lịch sử dư nợ")}
          </TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 py-4">
            {/* Left: patient info */}
            <div>
              <Card className="mb-4">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{t("Thông tin bệnh nhân")}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Pencil size={14} />
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <table style={{ width: "100%", borderSpacing: "0 8px", fontSize: 13 }}>
                    <tbody>
                      {[
                        { label: t("Mã BN"), value: `[${patient.code}]` },
                        { label: t("Họ và tên"), value: patient.fullName },
                        { label: t("Ngày sinh"), value: formatDate(patient.dateOfBirth) },
                        { label: t("Giới tính"), value: GENDER_LABELS[patient.gender] },
                        { label: t("Số điện thoại"), value: patient.phone },
                        { label: t("Email"), value: patient.email ?? "—" },
                        { label: t("Địa chỉ"), value: patient.address ?? "—" },
                      ].map(({ label, value }) => (
                        <tr key={label}>
                          <td style={{ color: "#5A6B82", paddingRight: 16, paddingBottom: 4, whiteSpace: "nowrap", verticalAlign: "top" }}>
                            {label}
                          </td>
                          <td style={{ fontWeight: 500, color: "#1B2A41" }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: "#5A6B82", fontSize: 12, marginBottom: 6 }}>{t("Nhãn / Tag")}</div>
                    <span className="inline-block px-2.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      {t("Chỉnh Nha")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: financial summary + treatment history */}
            <div className="lg:col-span-2">
              {/* Financial summary */}
              {(() => {
                const totalCost = patientInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const totalPaid = patientInvoices.reduce((s, inv) => s + (inv.paidAmount ?? 0), 0);
                const totalDebt = Math.max(0, totalCost - totalPaid);
                return (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: t("Tổng chi phí"), value: totalCost,  color: "#1B2A41" },
                      { label: t("Thực thu"),              value: totalPaid,  color: "#10B981" },
                      { label: t("Công nợ"),              value: totalDebt,  color: "#EF4444" },
                    ].map(({ label, value, color }) => (
                      <Card key={label}>
                        <CardContent className="p-3 text-center">
                          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color }}>
                            {formatVND(value)}
                            <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>đ</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}

              {/* Treatment history */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{t("Lịch sử điều trị")}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ width: 110 }}>{t("Ngày")}</TableHead>
                          <TableHead>{t("Dịch vụ / Thủ thuật")}</TableHead>
                          <TableHead style={{ width: 140 }}>{t("Bác sĩ")}</TableHead>
                          <TableHead style={{ width: 130 }}>{t("Trạng thái")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.filter((a) => a.status === "completed").length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                              {t("Chưa có lịch sử điều trị")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          appointments
                            .filter((a) => a.status === "completed")
                            .map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs">{formatDate(a.startTime)}</TableCell>
                                <TableCell className="text-xs">{a.reason ?? t("Khám tổng quát")}</TableCell>
                                <TableCell className="text-xs">{a.doctorName}</TableCell>
                                <TableCell>
                                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                    {t("Hoàn thành")}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Consulting tab */}
        <TabsContent value="consulting" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 py-4">
            {/* Left: dental chart */}
            <div>
              <Card className="mb-4">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{t("Biểu đồ răng")}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">{t("Thêm ảnh")}</Button>
                    <Button variant="outline" size="sm">{t("Danh mục")}</Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <Tabs defaultValue="select">
                    <TabsList className="mb-2">
                      <TabsTrigger value="select">{t("Chọn Răng")}</TabsTrigger>
                      <TabsTrigger value="upper">{t("Hàm Trên")}</TabsTrigger>
                      <TabsTrigger value="lower">{t("Hàm Dưới")}</TabsTrigger>
                      <TabsTrigger value="full">{t("Nguyên Hàm")}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <DentalChartView
                    teeth={selectedTeeth}
                    onToothClick={handleToothClick}
                    style={{ marginTop: 8 }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                    {t("Đã chọn:")}{" "}
                    {selectedTeeth.length > 0
                      ? selectedTeeth.map((tooth) => tooth.fdi).join(", ")
                      : t("Chưa chọn răng")}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: diagnosis records */}
            <div>
              <Card className="mb-4">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{t("Phiếu chẩn đoán")}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {diagnosesLoading ? (
                    <div className="grid place-items-center py-6"><Loader2 className="size-5 animate-spin" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead style={{ width: 100 }}>{t("Số phiếu")}</TableHead>
                            <TableHead style={{ width: 160 }}>{t("Bác sĩ chẩn đoán")}</TableHead>
                            <TableHead>{t("Răng")}</TableHead>
                            <TableHead>{t("Ghi chú")}</TableHead>
                            <TableHead style={{ width: 110 }}>{t("Thao tác")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diagnosisRows.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-6" style={{ color: "#9CA3AF" }}>{t("Chưa có phiếu chẩn đoán")}</TableCell></TableRow>
                          ) : (
                            diagnosisRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="text-xs">{row.code}</TableCell>
                                <TableCell className="text-xs">{row.staffName ?? "—"}</TableCell>
                                <TableCell className="text-xs">{formatTeeth(row.teeth)}</TableCell>
                                <TableCell className="text-xs">{row.note ?? "—"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 px-2" disabled={row.hasTreatmentService}>
                                    {row.hasTreatmentService ? t("Đã tạo DV") : t("Tạo Dịch Vụ")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{t("Phiếu tư vấn")}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {advisesLoading ? (
                    <div className="grid place-items-center py-6"><Loader2 className="size-5 animate-spin" /></div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead style={{ width: 100 }}>{t("Ngày")}</TableHead>
                              <TableHead>{t("Dịch vụ")}</TableHead>
                              <TableHead style={{ width: 50 }} className="text-right">{t("SL")}</TableHead>
                              <TableHead style={{ width: 110 }} className="text-right">{t("Đơn giá")}</TableHead>
                              <TableHead style={{ width: 120 }} className="text-right">{t("Thành tiền")}</TableHead>
                              <TableHead style={{ width: 120 }}>{t("Trạng thái")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {adviseRows.length === 0 ? (
                              <TableRow><TableCell colSpan={6} className="text-center py-6" style={{ color: "#9CA3AF" }}>{t("Chưa có phiếu tư vấn")}</TableCell></TableRow>
                            ) : (
                              (adviseRows as unknown as Record<string, unknown>[]).map((row) => {
                                const status = row.status as PatientAdviseStatus;
                                const conf = ADVISE_STATUS_CONFIG[status];
                                return (
                                  <TableRow key={row.id as string}>
                                    <TableCell className="text-xs">{formatDate(row.creationTime as string)}</TableCell>
                                    <TableCell className="text-xs">{(row.serviceName as string | null) ?? (row.code as string)}</TableCell>
                                    <TableCell className="text-xs text-right">{row.quantity as number}</TableCell>
                                    <TableCell className="text-xs text-right">{formatVND(row.price as number)} đ</TableCell>
                                    <TableCell className="text-xs text-right">{formatVND(row.effectiveAmount as number)} đ</TableCell>
                                    <TableCell>
                                      <span
                                        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                        style={{ background: conf.color + "22", color: conf.color }}
                                      >
                                        {conf.label}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      <div style={{
                        display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                        padding: "10px 0", borderTop: "1px solid #E5E7EB",
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("TỔNG KẾ HOẠCH")}</span>
                        <span style={{ fontSize: 13, color: "#5A6B82" }}>
                          {t("Tổng thành tiền:")} {formatVND(adviseSummary?.totalEffectiveAmount ?? 0)} đ
                        </span>
                        {(adviseSummary?.totalDiscountAmount ?? 0) > 0 && (
                          <span style={{ fontSize: 13, color: "#5A6B82" }}>
                            {t("Chiết khấu")}: {formatVND(adviseSummary?.totalDiscountAmount ?? 0)} đ
                          </span>
                        )}
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                          <Button variant="outline" size="sm">{t("Thêm kế hoạch điều trị")}</Button>
                          <Button variant="outline" size="sm">{t("Tạo báo giá")}</Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Treatment plan tab */}
        <TabsContent value="treatment-plan" className="mt-0">
          <div className="py-4">
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline"><Plus size={14} className="mr-2" />{t("Tạo kế hoạch mới")}</Button>
              <Button variant="outline">{t("Xem tất cả dịch vụ")}</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card style={{ borderLeft: "4px solid #2671D8" }}>
                <CardContent className="p-3 flex items-center gap-2">
                  <span style={{ background: "#2671D8", color: "#fff", borderRadius: 12, padding: "2px 10px", fontWeight: 700, fontSize: 14 }}>0</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41" }}>{t("Dịch vụ đang điều trị")}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("Chưa có dịch vụ đang điều trị")}</div>
                  </div>
                </CardContent>
              </Card>
              <Card style={{ borderLeft: "4px solid #10B981" }}>
                <CardContent className="p-3">
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 4 }}>{t("Dịch vụ có công đoạn gần nhất")}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("Chưa có công đoạn")}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: 120 }}>{t("Thêm công đoạn")}</TableHead>
                        <TableHead style={{ width: 80 }}>{t("Số phiếu")}</TableHead>
                        <TableHead style={{ width: 200 }}>{t("Dịch vụ")}</TableHead>
                        <TableHead style={{ width: 140 }}>{t("Bác sĩ tiếp nhận")}</TableHead>
                        <TableHead style={{ width: 140 }}>{t("Trạng thái")}</TableHead>
                        <TableHead style={{ width: 110 }}>{t("Ngày tạo hồ sơ")}</TableHead>
                        <TableHead style={{ width: 120 }} className="text-right">{t("Tổng phiếu")}</TableHead>
                        <TableHead style={{ width: 110 }} className="text-right">{t("Giảm giá")}</TableHead>
                        <TableHead style={{ width: 120 }} className="text-right">{t("Thành tiền")}</TableHead>
                        <TableHead style={{ width: 110 }} className="text-right">{t("Đã trả")}</TableHead>
                        <TableHead style={{ width: 100 }} className="text-right">{t("Hoàn tiền")}</TableHead>
                        <TableHead style={{ width: 120 }} className="text-right">{t("Còn lại")}</TableHead>
                        <TableHead style={{ width: 110 }} className="text-right">{t("Phải thu")}</TableHead>
                        <TableHead style={{ width: 80 }}>{t("Thao tác")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={14} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                            {t("Chưa có kế hoạch điều trị")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        plans.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2">+ {t("Công đoạn")}</Button>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="text-xs h-7 px-2">{p.id.slice(0, 8).toUpperCase()}</Button>
                            </TableCell>
                            <TableCell className="text-xs">{p.title}</TableCell>
                            <TableCell className="text-xs">—</TableCell>
                            <TableCell>
                              {p.status ? (
                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">{p.status}</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs">{p.creationTime ? formatDate(p.creationTime) : "—"}</TableCell>
                            <TableCell className="text-xs text-right">{formatVND(p.estimatedCost ?? 0)} đ</TableCell>
                            <TableCell className="text-xs text-right">{formatVND(0)} đ</TableCell>
                            <TableCell className="text-xs text-right">{formatVND(p.estimatedCost ?? 0)} đ</TableCell>
                            <TableCell className="text-xs text-right" style={{ color: "#10B981" }}>{formatVND(0)} đ</TableCell>
                            <TableCell className="text-xs text-right">{formatVND(0)} đ</TableCell>
                            <TableCell className="text-xs text-right" style={{ color: "#EF4444" }}>{formatVND(p.estimatedCost ?? 0)} đ</TableCell>
                            <TableCell className="text-xs text-right">{formatVND(p.estimatedCost ?? 0)} đ</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil size={14} /></Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appointment tab */}
        <TabsContent value="appointment" className="mt-0">
          <div className="py-4">
            {/* Counter cards */}
            {(() => {
              const counts: Record<string, number> = {
                scheduled: appointments.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
                arrived: appointments.filter((a) => a.status === "inProgress" || a.status === "completed").length,
                cancelled: appointments.filter((a) => a.status === "cancelled").length,
                late: appointments.filter((a) => a.status === "noShow").length,
              };
              return (
                <div className="flex gap-2 mb-4">
                  {APPOINTMENT_COUNTER_CARDS.map((card) => (
                    <div
                      key={card.key}
                      style={{
                        minWidth: 70, minHeight: 55, padding: "8px 14px",
                        borderTop: `3px solid ${card.borderColor}`,
                        backgroundColor: card.bgColor,
                        borderRadius: 8, textAlign: "center",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 20, fontWeight: 700, color: card.textColor }}>{counts[card.key] ?? 0}</span>
                      <span style={{ fontSize: 11, color: card.textColor }}>{card.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 140 }}>{t("Ngày / Giờ")}</TableHead>
                    <TableHead style={{ width: 160 }}>{t("Bác sĩ phụ trách")}</TableHead>
                    <TableHead>{t("Nội dung")}</TableHead>
                    <TableHead style={{ width: 180 }}>{t("Ghi chú")}</TableHead>
                    <TableHead style={{ width: 130 }}>{t("Trạng thái")}</TableHead>
                    <TableHead style={{ width: 80 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Chưa có lịch hẹn nào")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    appointments.map((a) => {
                      const conf = APPOINTMENT_STATUS_CONFIG[a.status] ?? { label: a.status, color: "#6B7280" };
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{formatDateTime(a.startTime)}</TableCell>
                          <TableCell className="text-xs">{a.doctorName}</TableCell>
                          <TableCell className="text-xs">{a.reason ?? t("Khám tổng quát")}</TableCell>
                          <TableCell className="text-xs">{a.notes ?? "—"}</TableCell>
                          <TableCell>
                            <span
                              style={{
                                display: "inline-block", padding: "2px 10px", borderRadius: 10,
                                backgroundColor: conf.color + "22", color: conf.color, fontSize: 12, fontWeight: 500,
                              }}
                            >
                              {conf.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil size={14} /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Image tab */}
        <TabsContent value="image" className="mt-0">
          <div className="py-4">
            <div className="flex items-center gap-3 mb-5">
              <Select>
                <SelectTrigger style={{ width: 220 }}>
                  <SelectValue placeholder={t("Giai đoạn điều trị")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">{t("Bản nháp")}</SelectItem>
                  <SelectItem value="PendingApproval">{t("Chờ duyệt")}</SelectItem>
                  <SelectItem value="Active">{t("Đang điều trị")}</SelectItem>
                  <SelectItem value="Completed">{t("Hoàn thành")}</SelectItem>
                  <SelectItem value="Cancelled">{t("Đã hủy")}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" style={{ marginLeft: "auto" }}>
                <Upload size={14} className="mr-2" />{t("Tải ảnh")}
              </Button>
            </div>
            <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
              <Image size={40} style={{ marginBottom: 12, color: "#D1D5DB" }} />
              <div style={{ fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>{t("Không có ảnh trong bộ lọc đã chọn")}</div>
              <div style={{ fontSize: 13 }}>{t("Hãy đổi bộ lọc hoặc tải thêm ảnh để tiếp tục.")}</div>
            </div>
          </div>
        </TabsContent>

        {/* Labo tab */}
        <TabsContent value="labo" className="mt-0">
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              {[
                { label: t("Đơn hàng mới"), count: 0, bg: "#E6F4EA", text: "#10B981", border: "#10B981" },
                { label: t("Tiếp tục công đoạn"), count: 0, bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" },
                { label: t("Bảo hành"), count: 0, bg: "#FCE8E6", text: "#DC2626", border: "#EF4444" },
              ].map((c) => (
                <button
                  key={c.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{c.count}</span>
                  {c.label}
                </button>
              ))}
              <Button style={{ marginLeft: "auto", background: "#2671D8" }}>
                <Plus size={14} className="mr-2" />{t("Tạo phiếu Labo")}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 120 }}>{t("Mã phiếu labo")}</TableHead>
                    <TableHead style={{ width: 160 }}>{t("Ngày gửi / Tình trạng mẫu")}</TableHead>
                    <TableHead style={{ width: 170 }}>{t("Ngày giao / Trạng thái Labo")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Bác sĩ chỉ định")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Nhà cung cấp")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Vật liệu")}</TableHead>
                    <TableHead style={{ width: 100 }}>{t("Số răng")}</TableHead>
                    <TableHead style={{ width: 80 }} className="text-right">{t("Số lượng")}</TableHead>
                    <TableHead style={{ width: 130 }}>{t("File Labo gửi về")}</TableHead>
                    <TableHead style={{ width: 80 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientLaboOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Không có dữ liệu")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patientLaboOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="text-xs">{o.orderCode}</TableCell>
                        <TableCell className="text-xs">{o.sentAt ? formatDate(o.sentAt) : "—"}</TableCell>
                        <TableCell className="text-xs">{o.receivedAt ? formatDate(o.receivedAt) : "—"}</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                        <TableCell className="text-xs">{o.labProviderName}</TableCell>
                        <TableCell className="text-xs">{o.workDescription ?? "—"}</TableCell>
                        <TableCell className="text-xs">{o.toothNumbers ?? "—"}</TableCell>
                        <TableCell className="text-xs text-right">1</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil size={14} /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Prescription tab */}
        <TabsContent value="prescription" className="mt-0">
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button style={{ background: "#2671D8" }}>
                <Plus size={14} className="mr-2" />{t("Tạo đơn thuốc")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Thuốc")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Liều dùng")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Tần suất")}</TableHead>
                    <TableHead style={{ width: 80 }} className="text-right">{t("Số ngày")}</TableHead>
                    <TableHead>{t("Hướng dẫn")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Trạng thái")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Ngày kê")}</TableHead>
                    <TableHead style={{ width: 80 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientPrescriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Không có đơn thuốc")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patientPrescriptions.flatMap((rx) =>
                      rx.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">{item.medicationName || "—"}</TableCell>
                          <TableCell className="text-xs">{item.dosage}</TableCell>
                          <TableCell className="text-xs">{item.frequency}</TableCell>
                          <TableCell className="text-xs text-right">{item.durationDays}</TableCell>
                          <TableCell className="text-xs">{item.instructions || "—"}</TableCell>
                          <TableCell className="text-xs">{rx.status}</TableCell>
                          <TableCell className="text-xs">{rx.issuedAt ? formatDate(rx.issuedAt) : "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil size={14} /></Button>
                          </TableCell>
                        </TableRow>
                      )),
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Care tab */}
        <TabsContent value="care" className="mt-0">
          <div className="py-4">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {[
                t("Đã chăm sóc"), t("Tốt"), t("Khá"), t("Bình thường"),
                t("Khiếu nại"), t("Đặc biệt"), t("Định kỳ"), t("Cơ bản"),
              ].map((label) => (
                <button
                  key={label}
                  style={{
                    padding: "4px 12px", borderRadius: 16, border: "1px solid #E5E7EB",
                    background: "#F9FAFB", color: "#374151", fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>0</span>
                  {label}
                </button>
              ))}
              <Button variant="outline" style={{ marginLeft: "auto" }}>{t("CSKH đặc biệt")}</Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 130 }}>{t("Ngày chăm sóc")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Trạng thái CSKH")}</TableHead>
                    <TableHead style={{ width: 160 }}>{t("Nhóm")}</TableHead>
                    <TableHead style={{ width: 180 }}>{t("Dịch vụ")}</TableHead>
                    <TableHead>{t("Nội dung")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Bác sĩ điều trị")}</TableHead>
                    <TableHead style={{ width: 150 }}>{t("Nhân viên chăm sóc")}</TableHead>
                    <TableHead style={{ width: 100 }}>{t("Đánh giá")}</TableHead>
                    <TableHead style={{ width: 100 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientCareRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Chưa có dữ liệu chăm sóc")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patientCareRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.dueAt ? formatDate(r.dueAt) : formatDate(r.creationTime)}</TableCell>
                        <TableCell className="text-xs">{r.status}</TableCell>
                        <TableCell className="text-xs">{r.type}</TableCell>
                        <TableCell className="text-xs">{r.subject}</TableCell>
                        <TableCell className="text-xs">{r.description ?? "—"}</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                        <TableCell className="text-xs">{r.resolution ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil size={14} /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Invoice tab */}
        <TabsContent value="invoice" className="mt-0">
          <div className="py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 140 }}>{t("Số hóa đơn")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Ngày tạo hồ sơ")}</TableHead>
                    <TableHead style={{ width: 140 }} className="text-right">{t("Thành tiền")}</TableHead>
                    <TableHead style={{ width: 140 }} className="text-right">{t("Đã trả")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Trạng thái")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Chưa có hóa đơn")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patientInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-xs">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{inv.issuedAt ? formatDate(inv.issuedAt) : "—"}</TableCell>
                        <TableCell className="text-xs text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatVND(inv.totalAmount ?? 0)} đ
                        </TableCell>
                        <TableCell className="text-xs text-right" style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
                          {formatVND(inv.paidAmount ?? 0)} đ
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              background: inv.status === INVOICE_STATUS.Paid ? "#D1FAE5" : inv.status === INVOICE_STATUS.Draft ? "#F3F4F6" : "#FEF3C7",
                              color: inv.status === INVOICE_STATUS.Paid ? "#065F46" : inv.status === INVOICE_STATUS.Draft ? "#374151" : "#92400E",
                            }}
                          >
                            {inv.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Debt history tab */}
        <TabsContent value="debt-history" className="mt-0">
          <div className="py-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 160 }}>{t("Ngày giao dịch")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Loại")}</TableHead>
                    <TableHead style={{ width: 140 }} className="text-right">{t("Số tiền")}</TableHead>
                    <TableHead style={{ width: 160 }}>{t("Nhân viên")}</TableHead>
                    <TableHead>{t("Ghi chú")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientInvoices.filter((inv) => (inv.totalAmount - inv.paidAmount) > 0).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6" style={{ color: "#9CA3AF" }}>
                        {t("Chưa có lịch sử dư nợ")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patientInvoices
                      .filter((inv) => (inv.totalAmount - inv.paidAmount) > 0)
                      .map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs">{inv.issuedAt ? formatDateTime(inv.issuedAt) : "—"}</TableCell>
                          <TableCell className="text-xs">
                            {inv.status === INVOICE_STATUS.Paid
                              ? t("Thanh toán")
                              : inv.status === INVOICE_STATUS.Voided
                                ? t("Huỷ")
                                : t("Hóa đơn")}
                          </TableCell>
                          <TableCell className="text-xs text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatVND(inv.totalAmount - inv.paidAmount)} đ
                          </TableCell>
                          <TableCell className="text-xs">—</TableCell>
                          <TableCell className="text-xs">{inv.invoiceNumber} — {inv.status}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
