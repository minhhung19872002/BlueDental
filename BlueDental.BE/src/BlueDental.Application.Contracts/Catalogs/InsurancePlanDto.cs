using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

public class InsurancePlanDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? ProviderName { get; set; }
    public decimal CoveragePercentage { get; set; }
    public decimal? MaxAnnualBenefit { get; set; }
    public bool IsActive { get; set; }
}

public class MedicationDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string GenericName { get; set; } = default!;
    public string? BrandName { get; set; }
    public string? DosageForm { get; set; }
    public string? Strength { get; set; }
    public bool RequiresPrescription { get; set; }
    public bool IsActive { get; set; }
}
