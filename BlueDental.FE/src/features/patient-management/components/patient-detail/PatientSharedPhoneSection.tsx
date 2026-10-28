import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { PhoneOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatMoneyUnit, MONEY_MASK } from "@/utils/format";
import { usePatientLinkedPeople } from "../../api/patientQueries";
import type { PatientDto, PatientPrefill, PhoneGroupMember } from "../../types/patient";
import { PatientEditorDialog } from "../PatientEditorDialog";
import { HolderCard, type HolderChip } from "../shared-phone/HolderCard";
import { holderLineWithAge, relationChip } from "../shared-phone/holderMeta";

interface Props {
  patient: PatientDto;
  /** patient.create — the + makes another hồ sơ on this number. */
  canCreate: boolean;
}

function memberChip(member: PhoneGroupMember): HolderChip | null {
  if (member.isPhoneOwner) return { label: t("Patient:SharedPhone:PhoneOwner"), tone: "owner" };
  const label = relationChip(member.relationType, member.relatedToName);
  return label ? { label, tone: "plain" } : null;
}

/** BA P2010: without "Chi phí › Xem" the amounts arrive as 0, so none is printed. */
function memberDebt(amount: number, hidden: boolean): string | null {
  if (hidden) return MONEY_MASK;
  return amount > 0 ? t("Patient:SharedPhone:Debt", formatMoneyUnit(amount)) : null;
}

/**
 * "NGƯỜI DÙNG CHUNG SĐT (n)" on the Hồ sơ tab (P2710_02): the other hồ sơ on
 * the record's number, Chủ số first, each opening its own hồ sơ, then the
 * group's total debt. + opens "Tạo hồ sơ" on the number, already linked to
 * this record.
 */
export function PatientSharedPhoneSection({ patient, canCreate }: Props) {
  const { data } = usePatientLinkedPeople(patient.id);
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const [adding, setAdding] = useState(false);
  // The dialog resets its form whenever the prefill changes identity.
  const prefill = useMemo<PatientPrefill>(
    () => ({ phone: patient.phoneNumber ?? undefined, sharedPhoneAnchorId: patient.id }),
    [patient.phoneNumber, patient.id],
  );

  if (!data) return null;
  const members = data.sharedPhone;
  const canAdd = canCreate && data.canAddSharedPhone;
  if (members.length === 0 && !canAdd) return null;

  const openMember = (id: string) => navigate(withBranch(`/patient/${id}`, branchId));
  const groupDebt = data.moneyHidden ? MONEY_MASK : formatMoneyUnit(data.groupDebt);

  return (
    <section className="pd-guardians pd-shared-phone" aria-label={t("Patient:SharedPhone:SectionTitle")}>
      <header className="pd-guardians-head">
        <PhoneOutlined className="pd-guardians-icon" />
        <h4>{t("Patient:SharedPhone:SectionTitle")}</h4>
        <span className="pd-guardians-count">{members.length}</span>
        {canAdd && (
          <Button
            type="primary"
            shape="circle"
            size="small"
            className="pd-guardians-add"
            icon={<PlusOutlined />}
            aria-label={t("Patient:SharedPhone:Add")}
            onClick={() => setAdding(true)}
          />
        )}
      </header>

      {members.length === 0 ? (
        <p className="pd-guardians-empty">{t("Patient:SharedPhone:Empty")}</p>
      ) : (
        <>
          <ul className="pd-members">
            {members.map((member) => {
              const debt = memberDebt(member.totalDebt, data.moneyHidden);
              return (
                <li key={member.id}>
                  <HolderCard
                    className="pd-member"
                    name={member.fullName}
                    chip={memberChip(member)}
                    meta={holderLineWithAge(member)}
                    onSelect={() => openMember(member.id)}
                    trailing={
                      <>
                        {debt && <span className="pd-member-debt">{debt}</span>}
                        <Button
                          type="text"
                          size="small"
                          icon={<RightOutlined />}
                          aria-label={t("Patient:SharedPhone:OpenMember", member.fullName)}
                          onClick={() => openMember(member.id)}
                        />
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
          <p className="pd-members-total">
            {t("Patient:SharedPhone:GroupDebt")}{" "}
            <strong className={data.groupDebt > 0 ? "pd-members-total--owed" : undefined}>{groupDebt}</strong>
          </p>
        </>
      )}

      <PatientEditorDialog open={adding} patient={null} prefill={prefill} onClose={() => setAdding(false)} />
    </section>
  );
}
