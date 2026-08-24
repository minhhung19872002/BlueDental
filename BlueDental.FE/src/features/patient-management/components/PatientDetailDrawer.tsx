import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { usePatient } from "../api/patientQueries";
import { DentalChartView } from "./DentalChartView";
import { formatDate } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

interface Props {
  patientId: string | null;
  onClose: () => void;
}

export function PatientDetailDrawer({ patientId, onClose }: Props) {
  const GENDER_LABELS: Record<string, string> = {
    male: t("Nam"),
    female: t("Nữ"),
    other: t("Khác"),
  };
  const { data: patient, isLoading } = usePatient(patientId ?? "");

  return (
    <Sheet open={Boolean(patientId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent style={{ width: 640, maxWidth: "100vw" }} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {patient ? `${t("Hồ sơ")}: ${patient.fullName}` : t("Hồ sơ bệnh nhân")}
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="grid place-items-center min-h-[200px]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {patient && (
          <div className="flex flex-col gap-6 mt-4">
            <div className="flex gap-4 items-center">
              <Avatar style={{ width: 56, height: 56, backgroundColor: brand.blue }}>
                <AvatarFallback style={{ backgroundColor: brand.blue, color: "#fff", fontWeight: 700, fontSize: 20 }}>
                  {patient.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: brand.ink }}>
                  {patient.fullName}
                </div>
                <div style={{ fontSize: 13, color: brand.muted }}>
                  {t("Mã")}: {patient.code} &middot; {patient.age} {t("tuổi")}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 border rounded-md p-3 text-sm">
              {[
                { label: t("Ngày sinh"), value: formatDate(patient.dateOfBirth) },
                { label: t("Giới tính"), value: GENDER_LABELS[patient.gender] },
                { label: t("Số điện thoại"), value: patient.phone },
                { label: "Email", value: patient.email ?? "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs">{t("Địa chỉ")}</dt>
                <dd className="font-medium">{patient.address ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs">{t("Tiền sử bệnh")}</dt>
                <dd className="font-medium">{patient.medicalHistory ?? t("Không có")}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs">{t("Dị ứng")}</dt>
                <dd>
                  {patient.allergies.length > 0
                    ? patient.allergies.map((a) => (
                        <span key={a} className="inline-block px-2 py-0.5 mr-1 rounded text-xs bg-red-100 text-red-700">
                          {a}
                        </span>
                      ))
                    : t("Không có")}
                </dd>
              </div>
            </dl>

            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: brand.ink, marginBottom: 12 }}>
                {t("Biểu đồ răng")}
              </div>
              <DentalChartView readOnly />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
