using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

public class TreatmentPlanDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = default!;
    public Guid DentistId { get; set; }
    public string DentistName { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public TreatmentPlanStatus Status { get; set; }
    public DateOnly? EstimatedCompletionDate { get; set; }
}

public class CreateTreatmentPlanDto
{
    public Guid PatientId { get; set; }
    public Guid DentistId { get; set; }
    public Guid BranchId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public DateOnly? EstimatedCompletionDate { get; set; }
}

public class UpdateTreatmentPlanDto
{
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public DateOnly? EstimatedCompletionDate { get; set; }
}

public class ApproveTreatmentPlanDto
{
    public string? Notes { get; set; }
}

public class GetTreatmentPlanListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? BranchId { get; set; }
    public TreatmentPlanStatus? Status { get; set; }
}
