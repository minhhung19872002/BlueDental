using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

/// <summary>
/// One row of Dịch vụ - vật liệu.
///
/// A material belongs to a classification group, not to a supplier: the
/// reference's own groups are named after labs but are separate records from
/// the supplier list, and its item carries only <c>taxonomyId</c> — see
/// docs/clone/api.md §Labo §4. The group is a <see cref="Catalogs.Taxonomy"/>
/// under <c>TaxonomyGroups.LaboMaterial</c>.
/// </summary>
public class LaboMaterial : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The classification group this material is filed under.</summary>
    public Guid TaxonomyId { get; private set; }

    public string Name { get; private set; } = default!;

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    protected LaboMaterial() { }

    public static LaboMaterial Create(
        Guid id,
        Guid clinicBranchId,
        Guid taxonomyId,
        string name,
        int sortOrder = 0)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (taxonomyId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.MaterialNeedsGroup,
                "A labo material has to be filed under a classification group.");
        }

        return new LaboMaterial
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            TaxonomyId = taxonomyId,
            Name = name,
            SortOrder = sortOrder,
            IsActive = true,
        };
    }

    /// <summary>The dialog collects a name and a group, and saves both together.</summary>
    public LaboMaterial SetDetails(Guid taxonomyId, string name)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (taxonomyId == Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.MaterialNeedsGroup,
                "A labo material has to be filed under a classification group.");
        }

        TaxonomyId = taxonomyId;
        Name = name;
        return this;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
