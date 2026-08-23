using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// A named bucket used to present consulting lines as alternative packages
/// (Nhóm tư vấn).
///
/// Reference: <c>GET /api/v1/advise-groups?patientId=...</c>.
/// </summary>
public class AdviseGroup : FullAuditedAggregateRoot<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    /// <summary>Display order in the consulting tab.</summary>
    public int SortOrder { get; private set; }

    protected AdviseGroup() { }

    public static AdviseGroup Create(
        Guid id,
        Guid patientId,
        Guid clinicBranchId,
        string name,
        string? description = null,
        int sortOrder = 0)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        return new AdviseGroup
        {
            Id = id,
            PatientId = patientId,
            ClinicBranchId = clinicBranchId,
            Name = name,
            Description = description,
            SortOrder = sortOrder
        };
    }

    public AdviseGroup Rename(string name)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        Name = name;
        return this;
    }

    public AdviseGroup UpdateDescription(string? description)
    {
        Description = description;
        return this;
    }

    public AdviseGroup Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }
}
