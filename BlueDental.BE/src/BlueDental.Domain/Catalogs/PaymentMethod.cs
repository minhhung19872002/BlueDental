using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

public class PaymentMethodOption : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    protected PaymentMethodOption() { }

    public PaymentMethodOption(Guid id, string code, string name, string? description = null)
        : base(id)
    {
        Code = code;
        Name = name;
        Description = description;
        IsActive = true;
    }

    public void Update(string name, string? description)
    {
        Name = name;
        Description = description;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
