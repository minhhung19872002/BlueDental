using System;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// Thẻ hồ sơ — a coloured label pinned to a patient record.
///
/// Reference: /taxonomy/tags, a flat table of "Tên tag" and "Màu". Tags belong
/// to one clinic branch, like every other piece of clinic data.
/// </summary>
public class PatientTag : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = default!;

    /// <summary>Badge colour, "#RRGGBB". The reference always stores one.</summary>
    public string Color { get; private set; } = default!;

    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    protected PatientTag() { }

    public static PatientTag Create(
        Guid id,
        Guid clinicBranchId,
        string name,
        string color,
        string? description = null)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        GuardColor(color);

        return new PatientTag
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Name = name,
            Color = color,
            Description = description,
            IsActive = true
        };
    }

    public void Update(string name, string color, string? description)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        GuardColor(color);

        Name = name;
        Color = color;
        Description = description;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;

    private static void GuardColor(string color)
    {
        var isHex = color.StartsWith('#') &&
                    (color.Length == 7 || color.Length == 4) &&
                    color[1..].All(Uri.IsHexDigit);

        if (!isHex)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidTaxonomyColor,
                $"'{color}' is not a #RGB or #RRGGBB colour.");
        }
    }
}
