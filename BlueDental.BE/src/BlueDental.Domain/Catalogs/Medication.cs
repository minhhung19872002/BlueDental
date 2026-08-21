using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// Medication master catalog entry.
/// </summary>
public class Medication : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string GenericName { get; private set; } = default!;
    public string? BrandName { get; private set; }
    public string? DosageForm { get; private set; }
    public string? Strength { get; private set; }
    public string? Manufacturer { get; private set; }
    public bool RequiresPrescription { get; private set; }
    public bool IsActive { get; private set; }

    protected Medication() { }

    public Medication(
        Guid id,
        string code,
        string genericName,
        string? brandName = null,
        string? dosageForm = null,
        string? strength = null,
        bool requiresPrescription = true)
        : base(id)
    {
        Code = code;
        GenericName = genericName;
        BrandName = brandName;
        DosageForm = dosageForm;
        Strength = strength;
        RequiresPrescription = requiresPrescription;
        IsActive = true;
    }

    public Medication Deactivate() { IsActive = false; return this; }
    public Medication Activate() { IsActive = true; return this; }
}
