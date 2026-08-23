using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

public class MedicalRecordTemplate : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Content { get; private set; }
    public string? Description { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }

    protected MedicalRecordTemplate() { }

    public MedicalRecordTemplate(Guid id, string name, string? content = null, string? description = null, int sortOrder = 0)
        : base(id)
    {
        Name = name;
        Content = content;
        Description = description;
        SortOrder = sortOrder;
        IsActive = true;
    }

    public void Update(string name, string? content, string? description, int sortOrder)
    {
        Name = name;
        Content = content;
        Description = description;
        SortOrder = sortOrder;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
