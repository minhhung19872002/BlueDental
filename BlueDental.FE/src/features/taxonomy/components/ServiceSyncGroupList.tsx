import { useRef, type CSSProperties } from "react";
import { Spin } from "antd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { t } from "@/lib/i18n";
import type { useServiceSyncSelection } from "../hooks/useServiceSyncSelection";
import { groupCheckState, selectedInGroup, syncableServices } from "../serviceCatalogSync";
import { ServiceSyncGroupRow } from "./ServiceSyncGroupRow";

/** One folded group row, including its bottom rule — the first guess before a row is measured. */
const ROW_ESTIMATE = 49;
const NO_TICKS: ReadonlySet<string> = new Set();

interface Props {
  loading: boolean;
  hasGroups: boolean;
  disabled: boolean;
  selection: ReturnType<typeof useServiceSyncSelection>;
}

/**
 * The scrolling list of the sync dialog. Virtualised: a branch can carry
 * hundreds of groups (CLAUDE.md §16.9 — lists over 50 rows), and only the
 * rows in view are rendered. Unfolded groups are measured, so their height
 * is whatever their services need.
 */
export function ServiceSyncGroupList({ loading, hasGroups, disabled, selection }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const groups = selection.visibleGroups;

  const virtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: (index) => groups[index]?.taxonomyId ?? index,
    overscan: 8,
  });

  return (
    <div ref={scrollRef} className="bd-sync-dialog__list">
      {loading ? (
        <div className="bd-sync-dialog__loading">
          <Spin />
        </div>
      ) : !hasGroups ? (
        <p className="bd-sync-dialog__empty">{t("Taxonomy:Sync:NoGroups")}</p>
      ) : groups.length === 0 ? (
        <p className="bd-sync-dialog__empty">{t("Taxonomy:Sync:NoMatch")}</p>
      ) : (
        <div className="bd-sync-dialog__rows" style={{ "--bd-sync-rows-height": `${virtualizer.getTotalSize()}px` } as CSSProperties}>
          {virtualizer.getVirtualItems().map((item) => {
            const group = groups[item.index];
            const open = selection.isExpanded(group.taxonomyId);
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                className={["bd-sync-dialog__row", item.index === groups.length - 1 && "is-last"].filter(Boolean).join(" ")}
                style={{ "--bd-sync-row-y": `${item.start}px` } as CSSProperties}
              >
                <ServiceSyncGroupRow
                  group={group}
                  picked={selectedInGroup(group, selection.selected)}
                  syncable={syncableServices(group).length}
                  state={groupCheckState(group, selection.selected)}
                  open={open}
                  selected={open ? selection.selected : NO_TICKS}
                  disabled={disabled}
                  onToggleGroup={selection.handleToggleGroup}
                  onToggleService={selection.handleToggleService}
                  onOpenChange={selection.handleExpandedChange}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
