import { memo } from "react";
import { Checkbox } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { ServiceCatalogGroupDto } from "../api/clinicIntegrationApi";
import type { GroupCheckState } from "../serviceCatalogSync";

interface Props {
  /** The group as shown — narrowed to the matches while a search is typed. */
  group: ServiceCatalogGroupDto;
  /** Picked / syncable services of the group as shown. */
  picked: number;
  syncable: number;
  state: GroupCheckState;
  open: boolean;
  /**
   * The ticks, read only while the group is unfolded. A folded group gets
   * the same empty set every render, so ticking elsewhere never re-renders
   * it — the dialog can hold a thousand groups.
   */
  selected: ReadonlySet<string>;
  disabled: boolean;
  onToggleGroup: (taxonomyId: string) => void;
  onToggleService: (id: string) => void;
  onOpenChange: (taxonomyId: string, open: boolean) => void;
}

/**
 * One nhóm dịch vụ: a tick for the whole group, then the name with
 * "picked / syncable" and a chevron that unfolds its services. A service with
 * no code is listed, greyed, with "Chưa có mã", and cannot be ticked.
 */
export const ServiceSyncGroupRow = memo(function ServiceSyncGroupRow({
  group,
  picked,
  syncable,
  state,
  open,
  selected,
  disabled,
  onToggleGroup,
  onToggleService,
  onOpenChange,
}: Props) {
  const contentId = `bd-sync-group-${group.taxonomyId}`;

  return (
    <div className="bd-sync-group">
      <div className="bd-sync-group__head">
        <Checkbox
          aria-label={t("Taxonomy:Sync:SelectGroupAria", group.name)}
          checked={state === "checked"}
          indeterminate={state === "indeterminate"}
          disabled={disabled || syncable === 0}
          onChange={() => onToggleGroup(group.taxonomyId)}
        />
        <button
          type="button"
          className="bd-sync-group__trigger"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => onOpenChange(group.taxonomyId, !open)}
        >
          <span className="bd-sync-group__name">{group.name}</span>
          <span className="bd-sync-group__count">
            {picked}/{syncable}
            <DownOutlined className={["bd-sync-group__chevron", open && "is-open"].filter(Boolean).join(" ")} />
          </span>
        </button>
      </div>

      {open && (
        <div id={contentId} className="bd-sync-group__body">
          {group.services.length === 0 ? (
            <p className="bd-sync-group__empty">{t("Taxonomy:Sync:GroupEmpty")}</p>
          ) : (
            group.services.map((service) => (
              <label
                key={service.id}
                className={["bd-sync-service", !service.code && "is-disabled"].filter(Boolean).join(" ")}
              >
                <Checkbox
                  checked={selected.has(service.id)}
                  disabled={disabled || !service.code}
                  onChange={() => onToggleService(service.id)}
                />
                <span className="bd-sync-service__name">{service.name}</span>
                {service.code ? (
                  <span className="bd-sync-service__code">{service.code}</span>
                ) : (
                  <span className="bd-sync-service__nocode">{t("Taxonomy:Sync:NoCode")}</span>
                )}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
});
