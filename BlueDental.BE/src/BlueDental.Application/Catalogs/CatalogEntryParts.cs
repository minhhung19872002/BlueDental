using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Guids;

namespace BlueDental.Catalogs;

/// <summary>
/// Writes the parts only one catalog carries. Each block is skipped unless the
/// caller actually sent it, so saving a diagnosis never silently blanks a
/// service's price configuration. Shared by the dialogs' create/update and by
/// the Excel importer, which builds the same DTO from a row.
/// </summary>
internal static class CatalogEntryParts
{
    public static void Apply(
        CatalogEntry entry,
        IGuidGenerator guids,
        string? detailName,
        string? note,
        string? unit,
        ServiceConfigDto? serviceConfig,
        MedicineDto? medicine,
        List<ServiceStageDto>? stages,
        List<PrescriptionTemplateLineDto>? prescriptionLines)
    {
        entry.UpdateDetails(detailName, note, unit);

        if (serviceConfig != null)
        {
            entry.EnsureServiceConfig(guids.Create()).Update(
                serviceConfig.TaxRate,
                serviceConfig.PriceIncludesTax,
                serviceConfig.DiscountIsPercent,
                serviceConfig.DiscountValue,
                serviceConfig.RequireImage,
                serviceConfig.DeductDoctorOnWarranty,
                serviceConfig.SeparateRevenue,
                serviceConfig.ShowToothOnInvoice,
                serviceConfig.RevenueByStage,
                serviceConfig.RequireStageSequence,
                serviceConfig.WarrantyDays);
        }

        if (medicine != null)
        {
            entry.EnsureMedicine(guids.Create()).Update(
                medicine.ActiveIngredient,
                medicine.Usage,
                medicine.PurchasePrice,
                medicine.PrescriptionCode,
                medicine.UsageNote);
        }

        if (stages != null)
        {
            entry.ReplaceStages(stages.Select((stage, index) =>
                new CatalogServiceStage(guids.Create(), entry.Id, stage.Name, stage.Value, index)));
        }

        if (prescriptionLines != null)
        {
            entry.ReplacePrescriptionLines(prescriptionLines.Select((line, index) =>
                new PrescriptionTemplateLine(
                    guids.Create(),
                    entry.Id,
                    line.MedicineEntryId,
                    line.TimesPerDay,
                    line.AmountPerTime,
                    line.Days,
                    line.Usage,
                    line.OtherUsage,
                    index)));
        }
    }
}
