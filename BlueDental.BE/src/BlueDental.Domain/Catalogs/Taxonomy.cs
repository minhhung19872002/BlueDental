using System;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// A catalog group — the left-hand panel of every "Danh mục" sub-route
/// (Nhóm dịch vụ, Nhóm chẩn đoán, Nhóm vật tư, ...).
///
/// Reference: <c>GET /api/v1/taxonomy/?group=&lt;slug&gt;&amp;branchId=...&amp;includeCount=true</c>.
/// </summary>
public class Taxonomy : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Which catalog this group belongs to — see <see cref="TaxonomyGroups"/>.</summary>
    public string Group { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    /// <summary>URL-friendly alias shown by the reference alongside the name.</summary>
    public string? Alias { get; private set; }

    /// <summary>Badge colour, "#RRGGBB".</summary>
    public string? Color { get; private set; }

    public string? Description { get; private set; }

    /// <summary>Optional second-level grouping used by the reference.</summary>
    public string? SubGroup { get; private set; }

    /// <summary>System groups are seeded and cannot be renamed or deleted.</summary>
    public bool IsSystem { get; private set; }

    public int SortOrder { get; private set; }

    protected Taxonomy() { }

    public static Taxonomy Create(
        Guid id,
        Guid clinicBranchId,
        string group,
        string name,
        string? alias = null,
        string? color = null,
        string? description = null,
        string? subGroup = null,
        bool isSystem = false,
        int sortOrder = 0)
    {
        Check.NotNullOrWhiteSpace(group, nameof(group));
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (!TaxonomyGroups.IsKnown(group))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                $"'{group}' is not a taxonomy group observed on the reference application.");
        }

        GuardColor(color);

        return new Taxonomy
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Group = group,
            Name = name,
            Alias = alias,
            Color = color,
            Description = description,
            SubGroup = subGroup,
            IsSystem = isSystem,
            SortOrder = sortOrder
        };
    }

    public Taxonomy Rename(string name, string? alias = null)
    {
        GuardNotSystem();
        Check.NotNullOrWhiteSpace(name, nameof(name));

        Name = name;
        Alias = alias ?? Alias;
        return this;
    }

    public Taxonomy Recolor(string? color)
    {
        GuardColor(color);
        Color = color;
        return this;
    }

    public Taxonomy UpdateDescription(string? description)
    {
        Description = description;
        return this;
    }

    public Taxonomy Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    /// <summary>True when entries of this group carry a price (dịch vụ, thuốc, vật tư).</summary>
    public bool IsPriced => TaxonomyGroups.Priced.Contains(Group);

    /// <summary>True when entries of this group carry template content (đơn thuốc mẫu, bệnh án mẫu).</summary>
    public bool IsTemplated => TaxonomyGroups.Templated.Contains(Group);

    private void GuardNotSystem()
    {
        if (IsSystem)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.SystemTaxonomyLocked,
                "A system taxonomy group cannot be modified.");
        }
    }

    private static void GuardColor(string? color)
    {
        if (color == null)
        {
            return;
        }

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
