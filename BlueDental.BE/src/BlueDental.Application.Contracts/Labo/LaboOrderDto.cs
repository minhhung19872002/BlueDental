using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Labo;

public class LaboOrderDto : FullAuditedEntityDto<Guid>
{
    public string OrderCode { get; set; } = default!;
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public string LabProviderName { get; set; } = default!;
    public LaboStatus Status { get; set; }
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public DateTimeOffset? ReceivedAt { get; set; }
    public decimal EstimatedCost { get; set; }
    public string? RejectionReason { get; set; }
    public string? PatientName { get; set; }
}

public class CreateLaboOrderDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? DentistId { get; set; }
    public string LabProviderName { get; set; } = default!;
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public DateOnly? DueDate { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class UpdateLaboOrderDto
{
    public string LabProviderName { get; set; } = default!;
    public string? ToothNumbers { get; set; }
    public string? WorkDescription { get; set; }
    public string? Notes { get; set; }
    public DateOnly? DueDate { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class GetLaboOrderListInput : PagedAndSortedResultRequestDto
{
    public Guid? BranchId { get; set; }
    public Guid? PatientId { get; set; }
    public LaboStatus? Status { get; set; }
    public string? Filter { get; set; }
}
