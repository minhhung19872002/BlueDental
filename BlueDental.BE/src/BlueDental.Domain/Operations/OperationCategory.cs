using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

public class OperationCategory : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Every row here is one branch's, as everywhere else.</summary>
    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = default!;
    public string Department { get; private set; } = default!;
    public string SubTab { get; private set; } = default!;
    public int SortOrder { get; private set; }

    protected OperationCategory() { }

    public OperationCategory(
        Guid id,
        Guid clinicBranchId,
        string name,
        string department,
        string subTab,
        int sortOrder = 0)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Name = name;
        Department = department;
        SubTab = subTab;
        SortOrder = sortOrder;
    }

    public OperationCategory Update(string name, int sortOrder)
    {
        Name = name;
        SortOrder = sortOrder;
        return this;
    }
}
