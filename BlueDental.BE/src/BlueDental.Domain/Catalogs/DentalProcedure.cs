using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// Master catalog entry for a dental procedure / service.
/// Aggregate root for the Catalogs bounded context.
/// </summary>
public class DentalProcedure : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public ProcedureCategory Category { get; private set; }
    public decimal BasePrice { get; private set; }
    public int EstimatedDurationMinutes { get; private set; }
    public bool RequiresXray { get; private set; }
    public bool IsActive { get; private set; }

    protected DentalProcedure() { }

    public DentalProcedure(
        Guid id,
        string code,
        string name,
        ProcedureCategory category,
        decimal basePrice,
        int estimatedDurationMinutes = 30,
        string? description = null)
        : base(id)
    {
        Code = code;
        Name = name;
        Category = category;
        BasePrice = basePrice;
        EstimatedDurationMinutes = estimatedDurationMinutes;
        Description = description;
        IsActive = true;
    }

    public DentalProcedure Update(
        string name,
        string code,
        ProcedureCategory category,
        int estimatedDurationMinutes,
        decimal basePrice,
        string? description)
    {
        Name = name;
        Code = code;
        Category = category;
        EstimatedDurationMinutes = estimatedDurationMinutes;
        BasePrice = basePrice;
        Description = description;
        return this;
    }

    public DentalProcedure UpdatePrice(decimal newPrice)
    {
        BasePrice = newPrice;
        return this;
    }

    public DentalProcedure Deactivate()
    {
        IsActive = false;
        return this;
    }

    public DentalProcedure Activate()
    {
        IsActive = true;
        return this;
    }
}
