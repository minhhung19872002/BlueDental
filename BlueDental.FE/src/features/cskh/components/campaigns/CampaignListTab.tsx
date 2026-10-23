import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";
import { SEND_BATCH_STATUS } from "../../api/sendApi";
import { useCampaigns, useStopCampaign, type Campaign } from "../../api/campaignApi";
import { CampaignTable } from "./CampaignTable";

interface CampaignListTabProps {
  /** "Gửi tin nhắn › Tạo": the one who may send may also stop any send of the branch. */
  canStop: boolean;
  onOpen: (id: string) => void;
}

/** A booked send that has not gone yet is called off whole; a running one keeps what already went. */
function stopMessage(campaign: Campaign): string {
  if (campaign.status === SEND_BATCH_STATUS.Queued && campaign.scheduledAt) {
    return t("CSKH:Campaign:StopBodyScheduled", campaign.templateName, formatDateTime(campaign.scheduledAt));
  }
  return t("CSKH:Campaign:StopBody", campaign.templateName);
}

/** "Chiến dịch đã gửi": every send of the branch, newest first (BA P2210, F-79). */
export function CampaignListTab({ canStop, onOpen }: CampaignListTabProps) {
  const pager = useTablePagination(10);
  const { data, isFetching } = useCampaigns({ skipCount: pager.skipCount, maxResultCount: pager.maxResultCount });
  const stop = useStopCampaign();
  const [stopping, setStopping] = useState<Campaign | null>(null);

  const handleConfirmStop = () => {
    if (!stopping) return;
    stop.mutate(stopping.id, {
      onSuccess: () => {
        toast.success(t("CSKH:Campaign:StoppedToast"));
        setStopping(null);
      },
    });
  };

  return (
    <>
      <CampaignTable
        items={data?.items ?? []}
        loading={isFetching && !data}
        pagination={pager.buildConfig(data?.totalCount ?? 0, countedTotal(t("CSKH:Campaign:Noun")))}
        onStop={canStop ? setStopping : null}
        onOpen={onOpen}
      />
      <ConfirmDialog
        open={stopping !== null}
        title={t("CSKH:Campaign:StopTitle")}
        message={stopping ? stopMessage(stopping) : ""}
        confirmLabel={t("CSKH:Campaign:Stop")}
        pending={stop.isPending}
        onConfirm={handleConfirmStop}
        onClose={() => setStopping(null)}
      />
    </>
  );
}
