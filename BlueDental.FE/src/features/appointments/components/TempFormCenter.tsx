import { useMemo } from "react";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { AppointmentColorPicker } from "./AppointmentColorPicker";
import { useTaxonomyGroupOptions, useCatalogOptions, CATALOG_GROUP } from "@/hooks/useCatalogOptions";
import type { TempAppointmentFormValues } from "./TempAppointmentForm";

interface Props {
  control: Control<TempAppointmentFormValues>;
  errors: FieldErrors<TempAppointmentFormValues>;
  doctorOptions: { value: string; label: string }[];
  watchedSourceTaxonomyId: string;
}

export function TempFormCenter({ control, errors, doctorOptions, watchedSourceTaxonomyId }: Props) {
  const { data: sourceGroups } = useTaxonomyGroupOptions(CATALOG_GROUP.Source);
  const { data: sourceEntries } = useCatalogOptions(CATALOG_GROUP.Source);

  const sourceGroupOptions = useMemo(
    () => (sourceGroups ?? []).map((g) => ({ value: g.id, label: g.name })),
    [sourceGroups],
  );

  const channelOptions = useMemo(() => {
    if (!watchedSourceTaxonomyId || !sourceEntries) return [];
    return sourceEntries
      .filter((e) => e.taxonomyId === watchedSourceTaxonomyId)
      .map((e) => ({ value: e.id, label: e.name }));
  }, [sourceEntries, watchedSourceTaxonomyId]);

  return (
    <div>
      {/* Doctor — optional for temp */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Chọn bác sĩ")}</label>
        <Controller
          name="doctorId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Chọn bác sĩ")}
              options={doctorOptions}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
      </div>

      {/* Source */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Nguồn đến")}</label>
        <Controller
          name="sourceTaxonomyId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Nguồn đến")}
              options={sourceGroupOptions}
              onChange={(v) => field.onChange(v ?? "")}
            />
          )}
        />
      </div>

      {/* Channel */}
      <div className="appt-field">
        <label className="appt-field-label">{t("Kênh kết nối")}</label>
        <Controller
          name="sourceEntryId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              value={field.value || undefined}
              placeholder={t("Kênh kết nối")}
              options={channelOptions}
              onChange={(v) => field.onChange(v ?? "")}
              disabled={!watchedSourceTaxonomyId}
            />
          )}
        />
      </div>

      {/* Color */}
      <Controller
        name="color"
        control={control}
        render={({ field }) => (
          <AppointmentColorPicker value={field.value} onChange={field.onChange} />
        )}
      />
    </div>
  );
}
