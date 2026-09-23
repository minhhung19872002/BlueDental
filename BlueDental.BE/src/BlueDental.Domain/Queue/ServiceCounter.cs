using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Queue;

public class ServiceCounter : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = default!;
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }

    protected ServiceCounter() { }

    public ServiceCounter(Guid id, Guid clinicBranchId, string name, int sortOrder)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 50);
        ClinicBranchId = clinicBranchId;
        Name = name;
        SortOrder = sortOrder;
        IsActive = true;
    }

    public ServiceCounter Update(string name, int sortOrder)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 50);
        Name = name;
        SortOrder = sortOrder;
        return this;
    }

    public ServiceCounter Activate()
    {
        IsActive = true;
        return this;
    }

    public ServiceCounter Deactivate()
    {
        IsActive = false;
        return this;
    }
}
