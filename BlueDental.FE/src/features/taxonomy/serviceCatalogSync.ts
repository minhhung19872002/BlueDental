import type {
  ServiceCatalogGroupDto,
  ServiceCatalogSyncItemDto,
  ServiceCatalogSyncResultDto,
  SyncServiceCatalogInput,
} from "./api/clinicIntegrationApi";

/**
 * The selection rules of "Chọn danh mục dịch vụ cần đồng bộ", read off the
 * reference's bundle (staging, 2026-09-25). Pure, so the dialog stays a view.
 */

/** Only a service with a code can be sent; the others are listed but greyed. */
export function syncableServices(group: ServiceCatalogGroupDto): ServiceCatalogSyncItemDto[] {
  return group.services.filter((service) => Boolean(service.code));
}

export function selectedInGroup(group: ServiceCatalogGroupDto, selected: ReadonlySet<string>): number {
  return syncableServices(group).filter((service) => selected.has(service.id)).length;
}

export type GroupCheckState = "checked" | "indeterminate" | "unchecked";

export function groupCheckState(group: ServiceCatalogGroupDto, selected: ReadonlySet<string>): GroupCheckState {
  const total = syncableServices(group).length;
  const picked = selectedInGroup(group, selected);
  if (total > 0 && picked === total) return "checked";
  return picked > 0 ? "indeterminate" : "unchecked";
}

export function totalSyncable(groups: ServiceCatalogGroupDto[]): number {
  return groups.reduce((sum, group) => sum + syncableServices(group).length, 0);
}

/** Ticks every syncable service of the group, or clears them all when every one is already ticked. */
export function toggleGroup(group: ServiceCatalogGroupDto, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  const services = syncableServices(group);
  const allPicked = services.every((service) => next.has(service.id));
  services.forEach((service) => (allPicked ? next.delete(service.id) : next.add(service.id)));
  return next;
}

export function toggleService(id: string, selected: ReadonlySet<string>): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAll(groups: ServiceCatalogGroupDto[]): Set<string> {
  return new Set(groups.flatMap((group) => syncableServices(group).map((service) => service.id)));
}

/**
 * Case-insensitive match on name or code. A group stays only if one of its
 * services matches, and then shows only the matching ones — groups are never
 * matched by their own name.
 */
export function filterGroups(groups: ServiceCatalogGroupDto[], search: string): ServiceCatalogGroupDto[] {
  const term = search.trim().toLowerCase();
  if (!term) return groups;

  return groups.flatMap((group) => {
    const services = group.services.filter(
      (service) => service.name.toLowerCase().includes(term) || service.code?.toLowerCase().includes(term),
    );
    return services.length > 0 ? [{ ...group, services }] : [];
  });
}

/**
 * A fully ticked group goes as its taxonomy id; a partly ticked one sends its
 * picks one by one. Computed on the unfiltered tree, so a search never narrows
 * what a whole-group tick means.
 */
export function buildSyncInput(groups: ServiceCatalogGroupDto[], selected: ReadonlySet<string>): SyncServiceCatalogInput {
  const taxonomyIds: string[] = [];
  const serviceIds: string[] = [];

  groups.forEach((group) => {
    const services = syncableServices(group);
    if (services.length > 0 && selectedInGroup(group, selected) === services.length) {
      taxonomyIds.push(group.taxonomyId);
      return;
    }
    services.forEach((service) => {
      if (selected.has(service.id)) serviceIds.push(service.id);
    });
  });

  return {
    ...(taxonomyIds.length ? { taxonomyIds } : {}),
    ...(serviceIds.length ? { serviceIds } : {}),
  };
}

export type SyncToast =
  | { kind: "error"; key: string; params: number[] }
  | { kind: "success"; key: string; params: number[] };

/**
 * The reference's toasts after a sync, in its order: a warning listing every
 * skip that carries a reason, then at most one of failure / "no change" /
 * success.
 */
export function syncToasts(result: ServiceCatalogSyncResultDto): { reasons: string[]; outcome: SyncToast | null } {
  const { total, sent, skipped } = result.summary;
  const reasons = result.skipped.map((item) => item.reason).filter((reason): reason is string => Boolean(reason));

  if (sent === 0 && skipped === 0 && total > 0) {
    return { reasons, outcome: { kind: "error", key: "Taxonomy:Sync:Toast:Failed", params: [total] } };
  }
  if (sent === 0 && reasons.length === 0 && skipped > 0) {
    return { reasons, outcome: { kind: "success", key: "Taxonomy:Sync:Toast:NoChange", params: [skipped, total] } };
  }
  if (sent > 0) {
    return { reasons, outcome: { kind: "success", key: "Taxonomy:Sync:Toast:Done", params: [sent, total] } };
  }
  return { reasons, outcome: null };
}
