import { useState } from "react";
import { Modal, Segmented } from "antd";
import { t } from "@/lib/i18n";
import type { ServiceCatalogSyncResultDto } from "../api/clinicIntegrationApi";
import { ServiceSyncResultTable, type SyncResultTab } from "./ServiceSyncResultTable";

interface Props {
  result: ServiceCatalogSyncResultDto | null;
  onClose: () => void;
}

/** The reference's tiles, in its order, each with its own colour. */
const TILES = [
  { key: "Total", tone: "ink" },
  { key: "Sent", tone: "green" },
  { key: "Updated", tone: "blue" },
  { key: "Failed", tone: "red" },
  { key: "Duplicated", tone: "amber" },
  { key: "Warned", tone: "amber" },
  { key: "Skipped", tone: "grey" },
] as const;

const TABS: SyncResultTab[] = ["duplicated", "warned", "skipped", "updated"];

const TAB_LABEL: Record<SyncResultTab, string> = {
  duplicated: "Taxonomy:Sync:Result:Tab:Duplicated",
  warned: "Taxonomy:Sync:Result:Tab:Warned",
  skipped: "Taxonomy:Sync:Result:Tab:Skipped",
  updated: "Taxonomy:Sync:Result:Tab:Updated",
};

function tileValue(key: (typeof TILES)[number]["key"], result: ServiceCatalogSyncResultDto): number {
  switch (key) {
    case "Total":
      return result.summary.total;
    case "Sent":
      return result.summary.sent;
    case "Updated":
      return result.summary.updated;
    case "Failed":
      return result.summary.failed;
    case "Duplicated":
      return result.duplicated.length;
    case "Warned":
      return result.warned.length;
    case "Skipped":
      return result.summary.skipped;
  }
}

/** Opens on the first tab with something in it, in the reference's order of concern. */
function firstTab(result: ServiceCatalogSyncResultDto): SyncResultTab {
  if (result.duplicated.length > 0) return "duplicated";
  if (result.warned.length > 0) return "warned";
  if (result.updated.length > 0) return "updated";
  if (result.skipped.length > 0) return "skipped";
  return "duplicated";
}

/**
 * "Kết quả đồng bộ danh mục dịch vụ" — shown after a sync from the toolbar.
 * Mounted per result, so each one opens on its own first tab.
 */
export function ServiceCatalogSyncResultDialog({ result, onClose }: Props) {
  return (
    <Modal
      open={Boolean(result)}
      title={<h2 className="bd-modal-title">{t("Taxonomy:Sync:Result:Title")}</h2>}
      width={768}
      footer={null}
      destroyOnHidden
      className="app-dialog bd-sync-result"
      onCancel={onClose}
    >
      {result && <ResultBody result={result} />}
    </Modal>
  );
}

function ResultBody({ result }: { result: ServiceCatalogSyncResultDto }) {
  const [tab, setTab] = useState<SyncResultTab>(() => firstTab(result));

  return (
    <div className="bd-sync-result__body">
      {result.batchErrors.length > 0 && (
        <div className="bd-sync-result__errors" role="alert">
          <p className="bd-sync-result__errors-title">{t("Taxonomy:Sync:Result:ErrorsTitle")}</p>
          <ul>
            {result.batchErrors.map((error, index) => (
              <li key={`${error.reason}-${index}`}>
                {error.reason}
                {error.message ? ` — ${error.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bd-sync-result__tiles">
        {TILES.map((tile) => (
          <div key={tile.key} className="bd-sync-result__tile">
            <p className="bd-sync-result__tile-label">{t(`Taxonomy:Sync:Result:Tile:${tile.key}`)}</p>
            <p className={`bd-sync-result__tile-value is-${tile.tone}`}>{tileValue(tile.key, result)}</p>
          </div>
        ))}
      </div>

      <Segmented<SyncResultTab>
        value={tab}
        onChange={setTab}
        options={TABS.map((value) => ({ value, label: t(TAB_LABEL[value]) }))}
      />

      <div className="bd-sync-result__list">
        <ServiceSyncResultTable tab={tab} result={result} />
      </div>
    </div>
  );
}
