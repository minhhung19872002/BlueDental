using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One medicine line of a "Đơn thuốc mẫu". Reference: the table inside the
/// prescription-template dialog.
/// </summary>
public class PrescriptionTemplateLine : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    /// <summary>The medicine, which is itself an entry of the thuốc catalog.</summary>
    public Guid MedicineEntryId { get; private set; }

    /// <summary>Ngày uống — how many times a day.</summary>
    public int TimesPerDay { get; private set; }

    /// <summary>Mỗi lần — how much each time.</summary>
    public decimal AmountPerTime { get; private set; }

    /// <summary>Số ngày.</summary>
    public int Days { get; private set; }

    /// <summary>Sử dụng — a multi-choice, so several may be set at once.</summary>
    public PrescriptionUsage Usage { get; private set; }

    /// <summary>
    /// What the user wrote for "Khác". The reference asks for it as soon as
    /// that box is ticked and refuses an empty one, so it is required exactly
    /// when the flag is set and meaningless otherwise.
    /// </summary>
    public string? OtherUsage { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>
    /// "Số lượng" — the reference shows it as a disabled box, so it is derived
    /// rather than stored, and cannot drift from the three numbers behind it.
    /// </summary>
    public decimal Quantity => TimesPerDay * AmountPerTime * Days;

    protected PrescriptionTemplateLine() { }

    public PrescriptionTemplateLine(
        Guid id,
        Guid catalogEntryId,
        Guid medicineEntryId,
        int timesPerDay,
        decimal amountPerTime,
        int days,
        PrescriptionUsage usage,
        string? otherUsage,
        int sortOrder) : base(id)
    {
        if (timesPerDay <= 0 || days <= 0 || amountPerTime <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidPrescriptionLine,
                "A prescription line needs a positive dose, frequency and duration.");
        }

        var wantsOther = usage.HasFlag(PrescriptionUsage.Other);
        var written = otherUsage?.Trim();

        if (wantsOther && string.IsNullOrEmpty(written))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidPrescriptionLine,
                "\"Khác\" needs the usage written out.");
        }

        CatalogEntryId = catalogEntryId;
        MedicineEntryId = medicineEntryId;
        TimesPerDay = timesPerDay;
        AmountPerTime = amountPerTime;
        Days = days;
        Usage = usage;
        // Dropped when "Khác" is not among the choices: keeping it would leave
        // a value behind that nothing displays.
        OtherUsage = wantsOther ? written : null;
        SortOrder = sortOrder;
    }
}
