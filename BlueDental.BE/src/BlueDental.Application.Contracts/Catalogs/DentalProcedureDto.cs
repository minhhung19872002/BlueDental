using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

public class DentalProcedureDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public ProcedureCategory Category { get; set; }
    public decimal BasePrice { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public bool IsActive { get; set; }
}

public class CreateDentalProcedureDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public ProcedureCategory Category { get; set; }
    public decimal BasePrice { get; set; }
    public int EstimatedDurationMinutes { get; set; } = 30;
}

public class UpdateDentalProcedureDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public ProcedureCategory Category { get; set; }
    public decimal BasePrice { get; set; }
    public int EstimatedDurationMinutes { get; set; }
}

public class GetDentalProcedureListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public ProcedureCategory? Category { get; set; }
    public bool? IsActive { get; set; }
}
