import { useEffect, useRef, useState } from "react";
import { Form } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { PhoneInput } from "@/components/PhoneInput";
import { t } from "@/lib/i18n";
import type { SharedPhoneLinkState } from "../../hooks/useSharedPhoneLink";
import type { PhoneGuardian, PhoneOwner } from "../../types/patient";
import { PATIENT_PHONE_PATTERN } from "../../utils/patientPhone";
import { PhoneHoldersDropdown, type HolderHandlers } from "./PhoneHoldersDropdown";
import { SharedPhoneLinkBlock } from "./SharedPhoneLinkBlock";
import "./shared-phone.css";

/** Who is already on the typed number, as far as the dialog asks (P2710_02). */
export interface SharedPhoneHolders {
  owners: readonly PhoneOwner[];
  guardians: readonly PhoneGuardian[];
}

interface Props {
  holders: SharedPhoneHolders;
  link: SharedPhoneLinkState;
  handlers: HolderHandlers;
  footerLabel: string;
  /** A number the dialog was opened with on purpose — its list stays shut until asked for. */
  quietPhone?: string;
}

/**
 * Điện thoại with what P2710_02 hangs off it: an "N hồ sơ" badge inside the
 * box, the holders' list under it (open as the results land, toggled by the
 * badge, shut by Esc or a click elsewhere), and the "Là … của …" block.
 */
export function SharedPhoneField({ holders, link, handlers, footerLabel, quietPhone }: Props) {
  const form = Form.useFormInstance();
  const phone = ((Form.useWatch("phone", form) as string | undefined) ?? "").trim();
  const [closedFor, setClosedFor] = useState<string | undefined>(quietPhone);
  const boxRef = useRef<HTMLDivElement>(null);

  const { owners, guardians } = holders;
  const rows = owners.length + guardians.length;
  const open = rows > 0 && closedFor !== phone;

  useEffect(() => {
    if (!open) return;
    const close = () => setClosedFor(phone);
    const handleMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !boxRef.current?.contains(event.target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Caught on the way down, so Esc shuts the list and not the dialog around it.
      event.stopPropagation();
      close();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, phone]);

  const toggle = () => setClosedFor(open ? phone : undefined);
  const close = () => setClosedFor(phone);

  const badge =
    rows > 0 ? (
      <button type="button" className="bd-phone-badge" aria-expanded={open} onClick={toggle}>
        {owners.length > 0
          ? t("Patient:SharedPhone:BadgeRecords", owners.length)
          : t("Patient:SharedPhone:BadgeGuardians", guardians.length)}
      </button>
    ) : (
      // Always a suffix: AntD remounts the box when one comes or goes.
      <span />
    );

  return (
    <div ref={boxRef} className={["bd-shared-phone", owners.length > 0 && "bd-shared-phone--taken"].filter(Boolean).join(" ")}>
      <FloatingField
        label={t("Patient:Form:Telephone")}
        name="phone"
        required
        rules={[
          { required: true, message: t("Patient:Form:RequiredPhone") },
          { pattern: PATIENT_PHONE_PATTERN, message: t("Patient:Form:InvalidPhone") },
        ]}
      >
        <PhoneInput suffix={badge} />
      </FloatingField>

      {/* A zero-height anchor: the list floats over the fields below instead of pushing them down. */}
      {open && (
        <div className="bd-phone-holders-anchor">
          <PhoneHoldersDropdown
            phone={phone}
            owners={owners}
            guardians={guardians}
            handlers={{
              ...handlers,
              onPickGuardian: (guardian) => {
                handlers.onPickGuardian(guardian);
                close();
              },
            }}
            footerLabel={footerLabel}
            onNewPerson={close}
          />
        </div>
      )}

      {link.required && <SharedPhoneLinkBlock link={link} holderCount={owners.length} onShowHolders={toggle} />}
    </div>
  );
}
