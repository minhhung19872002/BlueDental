import { useCallback } from "react";
import { Button, Form, Input } from "antd";
import { useClientIp } from "../api";
import { t } from "@/lib/i18n";

const FIELD = "allowedIpRanges";

/** Entries of the list as typed: lines, commas, semicolons or spaces. */
function entriesOf(text: string | undefined): string[] {
  return (text ?? "").split(/[\s,;]+/).filter(Boolean);
}

/**
 * Cụm 11 mục 11 — "IP được phép đăng nhập" on the branch dialog. The server
 * parses and normalizes the list; this field only offers the address the
 * server sees for the person editing, since that is the one they would
 * otherwise have to look up.
 */
export function BranchIpRangesField() {
  const form = Form.useFormInstance();
  const current = Form.useWatch<string | undefined>(FIELD, form);
  const { data: clientIp } = useClientIp(true);
  const alreadyListed = Boolean(clientIp) && entriesOf(current).includes(clientIp ?? "");

  const handleAddCurrent = useCallback(() => {
    if (!clientIp) return;
    const entries = entriesOf(form.getFieldValue(FIELD));
    form.setFieldValue(FIELD, [...entries, clientIp].join("\n"));
  }, [clientIp, form]);

  return (
    <div className="branch-ip-field">
      <Form.Item name={FIELD} label={t("Organization:AllowedIpRangesLabel")} extra={t("Organization:AllowedIpRangesHint")}>
        <Input.TextArea rows={3} placeholder={t("Organization:AllowedIpRangesPlaceholder")} />
      </Form.Item>
      {clientIp && (
        <div className="branch-ip-field__current">
          <span>{t("Organization:YourCurrentIp", clientIp)}</span>
          <Button size="small" type="link" onClick={handleAddCurrent} disabled={alreadyListed}>
            {alreadyListed ? t("Organization:CurrentIpListed") : t("Organization:AddCurrentIp")}
          </Button>
        </div>
      )}
    </div>
  );
}
