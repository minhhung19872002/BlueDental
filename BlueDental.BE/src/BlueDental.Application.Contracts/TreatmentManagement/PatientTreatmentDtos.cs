using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Billing;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>The reference's 13-field money rollup, repeated on patient / slip / line.</summary>
public class PaymentSummaryDto
{
    public decimal TotalPrice { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalDue { get; set; }
    public decimal Receivable { get; set; }
    public decimal PaidUncompleted { get; set; }
    public decimal CompletedValue { get; set; }
    public decimal TotalRefund { get; set; }
    public decimal Debt { get; set; }
    public decimal Discount { get; set; }
    public decimal OutstandingDebt { get; set; }
    public decimal OutstandingDebtConsumed { get; set; }
    public decimal Prepaid { get; set; }
    public decimal? CarryOverAmount { get; set; }
}

public class TreatmentServiceDto : EntityDto<Guid>
{
    public Guid TreatmentPlanId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid? SourceAdviseId { get; set; }
    public string Code { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal EffectiveAmount { get; set; }
    public TreatmentServiceStatus Status { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public string? ServiceName { get; set; }

    /// <summary>Công đoạn của dòng dịch vụ này.</summary>
    public int StageCount { get; set; }
    public int CompletedStageCount { get; set; }
}

public class TreatmentPlanSlipDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid DentistId { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public TreatmentPlanStatus Status { get; set; }
    public int ProgressPercent { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? VoucherDiscountAmount { get; set; }

    public decimal ServicesTotal { get; set; }
    public decimal PlanDiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }

    public PaymentSummaryDto Payment { get; set; } = new();
    public List<TreatmentServiceDto> Services { get; set; } = new();

    public string? DentistName { get; set; }
    public string? ConsultantName { get; set; }
}

/// <summary>Opens a slip from consulting lines the patient has accepted.</summary>
public class OpenTreatmentPlanDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid DentistId { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public string? Title { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }

    /// <summary>Accepted advises to pull in. Empty means every accepted advise.</summary>
    public List<Guid> AdviseIds { get; set; } = new();
}

public class GetTreatmentPlanSlipListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public TreatmentPlanStatus? Status { get; set; }
}

public class ApplyPlanDiscountDto
{
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
}

public class PatientPaymentDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? TreatmentServiceId { get; set; }
    public PatientPaymentKind Kind { get; set; }
    public PaymentMethodKind Method { get; set; }
    public decimal Amount { get; set; }
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset PaidAt { get; set; }
    public Guid StaffId { get; set; }
    public string? Note { get; set; }
    public string? StaffName { get; set; }
    public string? TreatmentPlanCode { get; set; }
}

public class RecordPatientPaymentDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? TreatmentServiceId { get; set; }
    public PatientPaymentKind Kind { get; set; }
    public PaymentMethodKind Method { get; set; }
    public decimal Amount { get; set; }
    public Guid StaffId { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public string? Note { get; set; }
}

public class GetPatientPaymentListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public PatientPaymentKind? Kind { get; set; }
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }
}

/// <summary>Everything the patient's money tab needs in one call.</summary>
public class PatientAccountDto
{
    public Guid PatientId { get; set; }
    public PaymentSummaryDto Payment { get; set; } = new();

    /// <summary>Đang giữ hộ khách.</summary>
    public decimal HeldForPatient { get; set; }

    public List<TreatmentPlanSlipDto> Plans { get; set; } = new();
    public List<PatientPaymentDto> Payments { get; set; } = new();
}

/// <summary>
/// Phiếu điều trị — reference: <c>/patient-treatments</c>.
/// </summary>
public interface IPatientTreatmentAppService : IApplicationService
{
    Task<PagedResultDto<TreatmentPlanSlipDto>> GetListAsync(GetTreatmentPlanSlipListInput input);
    Task<TreatmentPlanSlipDto> GetAsync(Guid id);
    Task<TreatmentPlanSlipDto> OpenAsync(OpenTreatmentPlanDto input);
    Task<TreatmentPlanSlipDto> ApplyDiscountAsync(Guid id, ApplyPlanDiscountDto input);
    Task<TreatmentPlanSlipDto> CompleteServiceAsync(Guid id, Guid serviceLineId);
    Task<TreatmentPlanSlipDto> CancelServiceAsync(Guid id, Guid serviceLineId);
}

/// <summary>
/// Thanh toán của bệnh nhân — thu tiền, hoàn tiền, giữ hộ.
/// </summary>
public interface IPatientPaymentAppService : IApplicationService
{
    Task<PagedResultDto<PatientPaymentDto>> GetListAsync(GetPatientPaymentListInput input);
    Task<PatientAccountDto> GetAccountAsync(Guid patientId, Guid? clinicBranchId = null);
    Task<PatientPaymentDto> RecordAsync(RecordPatientPaymentDto input);
    Task DeleteAsync(Guid id);
}
