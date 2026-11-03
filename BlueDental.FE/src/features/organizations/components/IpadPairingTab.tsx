import { useState } from "react";
import { Button, Input, QRCode, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Copy, Link2, Tablet } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  pairingLinkOf,
  usePairSigningDevice,
  useRevokeSigningDevice,
  useSigningDevices,
  type SigningDeviceDto,
} from "../api/signingDeviceApi";

interface Props {
  branchId: string;
  canEdit: boolean;
}

const text = (key: string) => t(`Organization:Ipad:${key}`);

/**
 * Cài đặt → Kết nối iPad (P2610): pair the counter iPad that shows a PHIẾU THU
 * for the customer to sign. The link carries a device token and is shown only
 * once; "Thu hồi" ends that iPad's access.
 */
export function IpadPairingTab({ branchId, canEdit }: Props) {
  const devices = useSigningDevices(branchId);
  const pair = usePairSigningDevice();
  const revoke = useRevokeSigningDevice();
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<SigningDeviceDto | null>(null);

  const handlePair = () =>
    pair.mutate(
      { clinicBranchId: branchId, name: name.trim() },
      {
        onSuccess: (paired) => {
          setLink(pairingLinkOf(paired.token));
          setName("");
        },
      },
    );

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success(text("Copied")))
      .catch(() => toast.error(text("CopyFailed")));
  };

  const handleRevoke = () => {
    if (!revoking) return;
    revoke.mutate(revoking.id, {
      onSuccess: () => {
        toast.success(text("Revoked"));
        setRevoking(null);
      },
    });
  };

  const columns: ColumnsType<SigningDeviceDto> = [
    { title: text("Name"), dataIndex: "name", key: "name" },
    { title: text("Created"), key: "created", render: (_, d) => formatDateTime(d.creationTime) },
    { title: text("LastSeen"), key: "seen", render: (_, d) => (d.lastSeenAt ? formatDateTime(d.lastSeenAt) : "—") },
    {
      title: text("Status"),
      key: "status",
      render: (_, d) => (d.isActive ? <Tag color="green">{text("Active")}</Tag> : <Tag>{text("RevokedTag")}</Tag>),
    },
    ...(canEdit
      ? [{
          title: "",
          key: "actions",
          render: (_: unknown, d: SigningDeviceDto) =>
            d.isActive && (
              <Button danger size="small" onClick={() => setRevoking(d)}>
                {text("Revoke")}
              </Button>
            ),
        }]
      : []),
  ];

  return (
    <div className="ipad-pair">
      <div className="profile-content-title">{text("Title")}</div>
      <p className="ipad-pair-intro">{text("Intro")}</p>

      {canEdit && (
        <div className="ipad-pair-create">
          <Input
            value={name}
            maxLength={100}
            placeholder={text("NamePlaceholder")}
            aria-label={text("Name")}
            onChange={(event) => setName(event.target.value)}
            onPressEnter={handlePair}
          />
          <Button
            type="primary"
            icon={<Link2 size={16} aria-hidden="true" />}
            loading={pair.isPending}
            disabled={pair.isPending || !name.trim()}
            onClick={handlePair}
          >
            {text("Create")}
          </Button>
        </div>
      )}

      {link && (
        <section className="ipad-pair-link" aria-label={text("LinkTitle")}>
          <QRCode value={link} size={160} bordered={false} />
          <div className="ipad-pair-link-body">
            <strong className="ipad-pair-link-title">
              <Tablet size={16} aria-hidden="true" />
              {text("LinkTitle")}
            </strong>
            <p>{text("LinkHelp")}</p>
            <div className="ipad-pair-link-row">
              <Input readOnly value={link} aria-label={text("LinkTitle")} />
              <Button icon={<Copy size={16} aria-hidden="true" />} onClick={handleCopy}>
                {text("Copy")}
              </Button>
            </div>
            <p className="ipad-pair-link-warn">{text("LinkOnce")}</p>
          </div>
        </section>
      )}

      <DataTable<SigningDeviceDto>
        columns={columns}
        dataSource={devices.data ?? []}
        rowKey="id"
        loading={devices.isLoading}
        pagination={false}
      />

      <ConfirmDialog
        open={revoking !== null}
        message={t("Organization:Ipad:RevokeConfirm", revoking?.name ?? "")}
        confirmLabel={text("Revoke")}
        pending={revoke.isPending}
        onConfirm={handleRevoke}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}
