using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Billing;

public class InsuranceClaimDto : FullAuditedEntityDto<Guid>
{
    public Guid InvoiceId { get; set; }
    public Guid PatientId { get; set; }
    public Guid InsurancePlanId { get; set; }
    public string ClaimReference { get; set; } = default!;
    public decimal ClaimedAmount { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public InsuranceClaimStatus Status { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? SettledAt { get; set; }
    public string? RejectionReason { get; set; }
    public string? Notes { get; set; }
}

public class CreateInsuranceClaimDto
{
    public Guid InvoiceId { get; set; }
    public Guid PatientId { get; set; }
    public Guid InsurancePlanId { get; set; }
    public decimal ClaimedAmount { get; set; }
    public string? Notes { get; set; }
}

public class ApproveInsuranceClaimDto
{
    public decimal ApprovedAmount { get; set; }
}

public class RejectInsuranceClaimDto
{
    public string Reason { get; set; } = default!;
}

public class GetInsuranceClaimListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? PatientId { get; set; }
    public InsuranceClaimStatus? Status { get; set; }
}
