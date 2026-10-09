using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One medicine line of a "BE:Common:RxTemplate". Doses by session (sáng / trưa /
/// chiều / tối) exactly as a patient's prescription line does, so picking the
/// template on the prescription screen copies the numbers as they are (R-884).
/// </summary>
public class PrescriptionTemplateLine : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    /// <summary>The medicine, which is itself an entry of the thuốc catalog.</summary>
    public Guid MedicineEntryId { get; private set; }

    /// <summary>Sáng — amount in the morning (half a tablet is allowed, 0 = none).</summary>
    public decimal Morning { get; private set; }

    /// <summary>Trưa.</summary>
    public decimal Noon { get; private set; }

    /// <summary>Chiều.</summary>
    public decimal Afternoon { get; private set; }

    /// <summary>Tối.</summary>
    public decimal Evening { get; private set; }

    /// <summary>Số ngày.</summary>
    public int Days { get; private set; }

    /// <summary>Sử dụng — a multi-choice, so several may be set at once.</summary>
    public PrescriptionUsage Usage { get; private set; }

    /// <summary>
    /// What the user wrote for "BE:Common:Other". The reference asks for it as soon as
    /// that box is ticked and refuses an empty one, so it is required exactly
    /// when the flag is set and meaningless otherwise.
    /// </summary>
    public string? OtherUsage { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>
    /// "BE:Col:Quantity" — the reference shows it as a disabled box, so it is derived
    /// rather than stored: (sáng + trưa + chiều + tối) × số ngày.
    /// </summary>
    public decimal Quantity => DailyAmount * Days;

    public decimal DailyAmount => Morning + Noon + Afternoon + Evening;

    protected PrescriptionTemplateLine() { }

    public PrescriptionTemplateLine(
        Guid id,
        Guid catalogEntryId,
        Guid medicineEntryId,
        decimal morning,
        decimal noon,
        decimal afternoon,
        decimal evening,
        int days,
        PrescriptionUsage usage,
        string? otherUsage,
        int sortOrder) : base(id)
    {
        if (morning < 0m || noon < 0m || afternoon < 0m || evening < 0m
            || days <= 0 || morning + noon + afternoon + evening <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidPrescriptionLine,
                "A prescription line needs at least one session above zero, none below, and a duration.");
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
        Morning = morning;
        Noon = noon;
        Afternoon = afternoon;
        Evening = evening;
        Days = days;
        Usage = usage;
        // Dropped when "BE:Common:Other" is not among the choices: keeping it would leave
        // a value behind that nothing displays.
        OtherUsage = wantsOther ? written : null;
        SortOrder = sortOrder;
    }
}
