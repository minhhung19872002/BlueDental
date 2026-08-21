using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// Represents an insurance plan supported by the clinic.
/// </summary>
public class InsurancePlan : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? ProviderName { get; private set; }
    public string? ProviderContactNumber { get; private set; }
    public decimal CoveragePercentage { get; private set; }
    public decimal? MaxAnnualBenefit { get; private set; }
    public bool IsActive { get; private set; }

    protected InsurancePlan() { }

    public InsurancePlan(
        Guid id,
        string code,
        string name,
        decimal coveragePercentage,
        string? providerName = null)
        : base(id)
    {
        Code = code;
        Name = name;
        CoveragePercentage = coveragePercentage;
        ProviderName = providerName;
        IsActive = true;
    }

    public InsurancePlan UpdateCoverage(decimal percentage, decimal? maxAnnualBenefit = null)
    {
        CoveragePercentage = percentage;
        MaxAnnualBenefit = maxAnnualBenefit;
        return this;
    }

    public InsurancePlan Deactivate() { IsActive = false; return this; }
    public InsurancePlan Activate() { IsActive = true; return this; }
}
