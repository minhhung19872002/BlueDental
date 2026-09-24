using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Guids;
using static BlueDental.Catalogs.Import.ImportLayout;

namespace BlueDental.Catalogs.Import;

/// <summary>
/// What an existing entry looks like once the file's row has been laid over
/// it: every column the row filled in takes the file's value, every blank
/// cell keeps what is stored. The same shape is then compared with the entry
/// (nothing differs → the row is skipped) and, on commit, written back.
/// </summary>
internal sealed record MergedEntry(
    string Name,
    int SortOrder,
    string? Code,
    decimal? Price,
    string? Content,
    string? Description,
    string? DetailName,
    string? Note,
    string? Unit,
    ServiceConfigDto? ServiceConfig,
    MedicineDto? Medicine,
    List<ServiceStageDto>? Stages,
    List<PrescriptionTemplateLineDto>? Lines);

internal static class EntryMerge
{
    /// <summary>
    /// Lays <paramref name="draft"/> over <paramref name="entry"/>. The lines
    /// are the template's medicine rows from the second sheet, or null when
    /// the file names none for it — then the stored lines stay.
    /// </summary>
    public static MergedEntry Merge(CatalogEntry entry, EntryDraft draft, List<PrescriptionTemplateLineDto>? lines)
    {
        var given = draft.Given;
        string? Text(string column, string? fromFile, string? stored) =>
            Normalize(given.Contains(column) ? fromFile : stored);

        return new MergedEntry(
            Name: draft.Name,
            SortOrder: given.Contains(Col.Priority) ? draft.SortOrder ?? entry.SortOrder : entry.SortOrder,
            Code: Text(Col.Code, draft.Code, entry.Code),
            Price: given.Contains(Col.Price) ? draft.Price : entry.Price,
            Content: Text(Col.Content, draft.Content, entry.Content),
            // Đơn thuốc mẫu writes its "Lời dặn" into Description.
            Description: given.Contains(Col.Description) || given.Contains(Col.Advice)
                ? Normalize(draft.Description)
                : Normalize(entry.Description),
            DetailName: Text(Col.DetailName, draft.DetailName, entry.DetailName),
            Note: Text(Col.Note, draft.Note, entry.Note),
            Unit: Text(Col.Unit, draft.Unit, entry.Unit),
            ServiceConfig: draft.ServiceConfig == null ? null : MergeServiceConfig(given, draft.ServiceConfig, entry.ServiceConfig),
            Medicine: draft.Medicine == null ? null : MergeMedicine(given, draft.Medicine, entry.Medicine),
            Stages: given.Contains(Col.Stages) ? draft.Stages : null,
            Lines: lines);
    }

    /// <summary>True when writing <paramref name="merged"/> would change anything on <paramref name="entry"/>.</summary>
    public static bool Differs(CatalogEntry entry, MergedEntry merged)
    {
        if (!string.Equals(entry.Name, merged.Name, StringComparison.Ordinal)
            || entry.SortOrder != merged.SortOrder
            || Normalize(entry.Code) != merged.Code
            || entry.Price != merged.Price
            || Normalize(entry.Content) != merged.Content
            || Normalize(entry.Description) != merged.Description
            || Normalize(entry.DetailName) != merged.DetailName
            || Normalize(entry.Note) != merged.Note
            || Normalize(entry.Unit) != merged.Unit)
        {
            return true;
        }

        if (merged.ServiceConfig != null && ServiceConfigDiffers(entry.ServiceConfig, merged.ServiceConfig))
        {
            return true;
        }

        if (merged.Medicine != null && MedicineDiffers(entry.Medicine, merged.Medicine))
        {
            return true;
        }

        if (merged.Stages != null && !entry.Stages
                .OrderBy(s => s.SortOrder)
                .Select(s => (s.Name, s.Value))
                .SequenceEqual(merged.Stages.Select(s => (s.Name, s.Value))))
        {
            return true;
        }

        return merged.Lines != null && !entry.PrescriptionLines
            .OrderBy(l => l.SortOrder)
            .Select(LineKey)
            .SequenceEqual(merged.Lines.Select(LineKey));
    }

    /// <summary>Writes <paramref name="merged"/> onto <paramref name="entry"/> through the same mutators the dialogs use.</summary>
    public static void Apply(CatalogEntry entry, MergedEntry merged, IGuidGenerator guids)
    {
        entry.Rename(merged.Name)
            .ChangeCode(merged.Code)
            .ChangePrice(merged.Price)
            .UpdateContent(merged.Content)
            .UpdateDescription(merged.Description)
            .Reorder(merged.SortOrder);

        CatalogEntryParts.Apply(entry, guids, merged.DetailName, merged.Note, merged.Unit,
            merged.ServiceConfig, merged.Medicine, merged.Stages, merged.Lines);
    }

    private static ServiceConfigDto MergeServiceConfig(
        IReadOnlySet<string> given, ServiceConfigDto file, CatalogServiceConfig? stored)
    {
        if (stored == null)
        {
            return file;
        }

        T Pick<T>(string column, T fromFile, T fromStore) => given.Contains(column) ? fromFile : fromStore;

        return new ServiceConfigDto
        {
            TaxRate = Pick(Col.TaxRate, file.TaxRate, stored.TaxRate),
            PriceIncludesTax = Pick(Col.PriceIncludesTax, file.PriceIncludesTax, stored.PriceIncludesTax),
            DiscountIsPercent = Pick(Col.DiscountIsPercent, file.DiscountIsPercent, stored.DiscountIsPercent),
            DiscountValue = Pick(Col.DiscountValue, file.DiscountValue, stored.DiscountValue),
            RequireImage = Pick(Col.RequireImage, file.RequireImage, stored.RequireImage),
            DeductDoctorOnWarranty = Pick(Col.DeductDoctorOnWarranty, file.DeductDoctorOnWarranty, stored.DeductDoctorOnWarranty),
            SeparateRevenue = Pick(Col.SeparateRevenue, file.SeparateRevenue, stored.SeparateRevenue),
            ShowToothOnInvoice = Pick(Col.ShowToothOnInvoice, file.ShowToothOnInvoice, stored.ShowToothOnInvoice),
            RevenueByStage = Pick(Col.RevenueByStage, file.RevenueByStage, stored.RevenueByStage),
            RequireStageSequence = Pick(Col.RequireStageSequence, file.RequireStageSequence, stored.RequireStageSequence),
            WarrantyDays = Pick(Col.WarrantyDays, file.WarrantyDays, stored.WarrantyDays)
        };
    }

    private static MedicineDto MergeMedicine(IReadOnlySet<string> given, MedicineDto file, CatalogMedicine? stored)
    {
        if (stored == null)
        {
            return file;
        }

        string? Text(string column, string? fromFile, string? fromStore) =>
            Normalize(given.Contains(column) ? fromFile : fromStore);

        return new MedicineDto
        {
            ActiveIngredient = Text(Col.ActiveIngredient, file.ActiveIngredient, stored.ActiveIngredient),
            Usage = Text(Col.Usage, file.Usage, stored.Usage),
            PurchasePrice = given.Contains(Col.PurchasePrice) ? file.PurchasePrice : stored.PurchasePrice,
            PrescriptionCode = Text(Col.PrescriptionCode, file.PrescriptionCode, stored.PrescriptionCode),
            UsageNote = Text(Col.UsageNote, file.UsageNote, stored.UsageNote)
        };
    }

    private static bool ServiceConfigDiffers(CatalogServiceConfig? stored, ServiceConfigDto merged) =>
        stored == null
        || stored.TaxRate != merged.TaxRate
        || stored.PriceIncludesTax != merged.PriceIncludesTax
        || stored.DiscountIsPercent != merged.DiscountIsPercent
        || stored.DiscountValue != merged.DiscountValue
        || stored.RequireImage != merged.RequireImage
        || stored.DeductDoctorOnWarranty != merged.DeductDoctorOnWarranty
        || stored.SeparateRevenue != merged.SeparateRevenue
        || stored.ShowToothOnInvoice != merged.ShowToothOnInvoice
        || stored.RevenueByStage != merged.RevenueByStage
        || stored.RequireStageSequence != merged.RequireStageSequence
        || stored.WarrantyDays != merged.WarrantyDays;

    private static bool MedicineDiffers(CatalogMedicine? stored, MedicineDto merged) =>
        stored == null
        || Normalize(stored.ActiveIngredient) != merged.ActiveIngredient
        || Normalize(stored.Usage) != merged.Usage
        || stored.PurchasePrice != merged.PurchasePrice
        || Normalize(stored.PrescriptionCode) != merged.PrescriptionCode
        || Normalize(stored.UsageNote) != merged.UsageNote;

    private static (Guid, int, decimal, int, PrescriptionUsage, string?) LineKey(PrescriptionTemplateLine line) =>
        (line.MedicineEntryId, line.TimesPerDay, line.AmountPerTime, line.Days, line.Usage, Normalize(line.OtherUsage));

    private static (Guid, int, decimal, int, PrescriptionUsage, string?) LineKey(PrescriptionTemplateLineDto line)
    {
        // The line entity drops "cách dùng khác" unless "Khác" is ticked; compare what it would store.
        var other = line.Usage.HasFlag(PrescriptionUsage.Other) ? Normalize(line.OtherUsage?.Trim()) : null;
        return (line.MedicineEntryId, line.TimesPerDay, line.AmountPerTime, line.Days, line.Usage, other);
    }

    /// <summary>An empty string and null are the same absence, whichever a dialog once saved.</summary>
    private static string? Normalize(string? text) => string.IsNullOrEmpty(text) ? null : text;
}
