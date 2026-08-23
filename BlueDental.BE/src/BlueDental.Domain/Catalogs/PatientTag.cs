using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

public class PatientTag : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Color { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    protected PatientTag() { }

    public PatientTag(Guid id, string name, string? color = null, string? description = null)
        : base(id)
    {
        Name = name;
        Color = color;
        Description = description;
        IsActive = true;
    }

    public void Update(string name, string? color, string? description)
    {
        Name = name;
        Color = color;
        Description = description;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
