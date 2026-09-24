using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Billing;
using BlueDental.CustomerCare;
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

/// <summary>One step of a service — the reference's <c>service.stages[]</c> entry.</summary>
public class ServiceStepDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>The reference's "BE:Field:Value" — what the step pays. Not used yet.</summary>
    public decimal Value { get; set; }
}

/// <summary>One labo order hanging off a service line, as the slip lists it.</summary>
public class TreatmentServiceLaboOrderDto : EntityDto<Guid>
{
    public string OrderCode { get; set; } = string.Empty;
    public BlueDental.Labo.LaboStatus Status { get; set; }
    public BlueDental.Labo.LaboOrderKind Kind { get; set; }
    /// <summary>Still with the labo: blocks cancelling / converting the line.</summary>
    public bool IsUnfinished { get; set; }
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

    /// <summary>1-based position on the slip; 0 on lines never reordered.</summary>
    public int SortOrder { get; set; }

    /// <summary>The other half of a conversion — see TreatmentService.ReplacedId.</summary>
    public Guid? ReplacedId { get; set; }

    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public string? ServiceName { get; set; }

    /// <summary>Công đoạn của dòng dịch vụ này.</summary>
    public int StageCount { get; set; }
    public int CompletedStageCount { get; set; }

    /// <summary>
    /// How long this service is under warranty, in days, copied from its catalog
    /// entry. Zero means the reference's "BE:Warranty:None": a finished công đoạn
    /// offers no Bảo hành at all.
    /// </summary>
    public int WarrantyDays { get; set; }

    /// <summary>
    /// "BE:Treatment:StageList" — the steps this service declares in Danh mục, in
    /// their own order. The công đoạn form lists them as checkboxes; the row
    /// itself has no state, each công đoạn keeps its own ticks.
    /// </summary>
    public List<ServiceStepDto> ServiceSteps { get; set; } = new();

    /// <summary>
    /// Nội dung điều trị — the notes written on this line's stages, in order.
    /// The reference's treatment table is stage-driven and prints the stage's
    /// own <c>note</c> in that column, not the service name.
    /// </summary>
    public List<string> StageNotes { get; set; } = new();

    /// <summary>
    /// Đã thu trên chính dòng này — payments tagged with this service line, less
    /// refunds. A payment recorded against the slip as a whole is not counted
    /// here; the slip's own rollup carries those.
    /// </summary>
    public decimal PaidAmount { get; set; }

    /// <summary>Còn nợ của dòng — what the payment dialog offers to collect.</summary>
    public decimal OutstandingAmount { get; set; }

    /// <summary>
    /// Chăm sóc sau điều trị. Null when no care record covers any of this line's
    /// stages, which the table prints as "BE:CareStatus:NotContacted".
    /// </summary>
    public CareStatus? AfterCareStatus { get; set; }

    /// <summary>
    /// The labo orders sent for this line — the reference's
    /// <c>include=labOrders[id,statusClinic,status]</c>. The Chuyển đổi dialog
    /// blocks while any of them is unfinished.
    /// </summary>
    public List<TreatmentServiceLaboOrderDto> LabOrders { get; set; } = new();

    /// <summary>
    /// The inline row's own columns (Thêm dịch vụ mới). Null on a line pulled
    /// from a consulting line — the client falls back to the advise / the slip.
    /// </summary>
    public Guid? DiagnosisId { get; set; }
    public string? DiagnosisName { get; set; }
    public Guid? DentistId { get; set; }
    public string? DentistName { get; set; }
    public string? Note { get; set; }
    public Guid? DiagnoserStaffId { get; set; }
    public string? DiagnoserName { get; set; }
    public Guid? SecondDiagnoserStaffId { get; set; }
    public string? SecondDiagnoserName { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public string? ConsultantName { get; set; }
    public Guid? SecondConsultantStaffId { get; set; }
    public string? SecondConsultantName { get; set; }
}

/// <summary>
/// One line written straight onto a slip from the Chi tiết tab's picker — the
/// reference's inline "new row" with Lưu / Hủy.
/// </summary>
public class AddTreatmentServiceDto
{
    public Guid ServiceId { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; } = 1;
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();

    /// <summary>The status pill on the new row; defaults to Created.</summary>
    public TreatmentServiceStatus? Status { get; set; }

    public Guid? DiagnosisId { get; set; }
    public Guid? DentistId { get; set; }
    public string? Note { get; set; }
    public Guid? DiagnoserStaffId { get; set; }
    public Guid? SecondDiagnoserStaffId { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public Guid? SecondConsultantStaffId { get; set; }
}

/// <summary>What the reference's "Loại chuyển đổi" offers.</summary>
public enum ServiceConversionType
{
    /// <summary>Thay thế — the line is redone as a different service.</summary>
    Replace = 1,

    /// <summary>Dịch vụ cũ — the same service again, at the price it was sold for.</summary>
    OldService = 2
}

/// <summary>What happens to money already collected beyond the new price.</summary>
public enum ConversionDifferenceHandling
{
    /// <summary>Hoàn tiền — the difference is refunded on the old service.</summary>
    Refund = 1,

    /// <summary>Dư nợ — the difference stays with the patient as credit.</summary>
    Debt = 2
}

/// <summary>
/// "Chuyển đổi dịch vụ": what the dialog saves. The old line is named by the
/// route, so only the new one is described here.
/// </summary>
public class ConvertTreatmentServiceDto
{
    public ServiceConversionType ConversionType { get; set; } = ServiceConversionType.Replace;

    /// <summary>The service to convert to; required for Thay thế, ignored otherwise.</summary>
    public Guid? ServiceId { get; set; }

    /// <summary>
    /// "BE:Common:Payment" — what the patient is charged for the new service. Null
    /// means the new service's full price.
    /// </summary>
    public decimal? PaymentAmount { get; set; }

    /// <summary>Only read when money already collected exceeds the new price.</summary>
    public ConversionDifferenceHandling? DifferenceHandling { get; set; }

    /// <summary>Ghi chú — required by the reference's dialog.</summary>
    public string Note { get; set; } = string.Empty;

    public List<ToothSelectionDto> Teeth { get; set; } = new();

    public Guid? DiagnoserStaffId { get; set; }
    public Guid? SecondDiagnoserStaffId { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public Guid? SecondConsultantStaffId { get; set; }
}

/// <summary>Where a dragged service line was dropped on its slip.</summary>
public class ReorderTreatmentServiceDto
{
    public Guid ServiceLineId { get; set; }

    /// <summary>1-based position within the slip's service lines.</summary>
    public int SortOrder { get; set; }
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

    /// <summary>
    /// The plan-level voucher already worked out on Chẩn đoán &amp; Tư vấn, so the
    /// slip opens on the same "BE:Field:TotalAmount" the screen showed. Added on top of the
    /// slip discount above, and capped with it at the slip total.
    /// </summary>
    public decimal? VoucherDiscountAmount { get; set; }

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

/// <summary>One service line's share of a receipt.</summary>
public class PatientPaymentLineDto
{
    public Guid TreatmentServiceId { get; set; }
    public decimal Amount { get; set; }
}

public class PatientPaymentDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }

    /// <summary>Chia Tiền Tự Động / Thủ Công.</summary>
    public PaymentSplitMode SplitMode { get; set; }

    /// <summary>What each service on this receipt was paid.</summary>
    public List<PatientPaymentLineDto> Lines { get; set; } = new();
    public PatientPaymentKind Kind { get; set; }
    public PaymentMethodKind Method { get; set; }
    public decimal Amount { get; set; }
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset PaidAt { get; set; }
    public Guid StaffId { get; set; }
    public string? Note { get; set; }
    public string? StaffName { get; set; }
    public string? TreatmentPlanCode { get; set; }

    /// <summary>Tài khoản nhận tiền, on Ngân hàng and Ví momo payments.</summary>
    public Guid? PaymentAccountId { get; set; }
}

/// <summary>
/// "BE:Common:Edit" on a receipt row: how the money was taken, not how much. The
/// amount and the service split are fixed once written — correcting those means
/// voiding the receipt and collecting again.
/// </summary>
public class UpdatePatientPaymentDto
{
    public PaymentMethodKind Method { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public string? Note { get; set; }

    /// <summary>Required when Method is Banking or EWallet; ignored otherwise.</summary>
    public Guid? PaymentAccountId { get; set; }
}

public class RecordPatientPaymentDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid? TreatmentPlanId { get; set; }

    /// <summary>
    /// Every service this one receipt covers. Required for a payment or refund
    /// against a slip — the reference refuses to save with none
    /// ("BE:Validation:SelectAtLeast1Service") — and left empty for money held.
    /// </summary>
    public List<Guid> TreatmentServiceIds { get; set; } = new();

    /// <summary>
    /// Chia Tiền Tự Động spreads <see cref="Amount"/> over those services,
    /// oldest first and never past what a line still owes; Chia Tiền Thủ Công
    /// takes <see cref="Items"/> instead.
    /// </summary>
    public PaymentSplitMode SplitMode { get; set; } = PaymentSplitMode.Auto;

    /// <summary>Required when <see cref="SplitMode"/> is Manual.</summary>
    public List<PatientPaymentLineDto> Items { get; set; } = new();
    public PatientPaymentKind Kind { get; set; }
    public PaymentMethodKind Method { get; set; }
    public decimal Amount { get; set; }
    public Guid StaffId { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public string? Note { get; set; }

    /// <summary>Required when Method is Banking or EWallet; ignored otherwise.</summary>
    public Guid? PaymentAccountId { get; set; }
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
    Task<TreatmentPlanSlipDto> AddServiceAsync(Guid id, AddTreatmentServiceDto input);
    Task<TreatmentPlanSlipDto> CompleteServiceAsync(Guid id, Guid serviceLineId);
    Task<TreatmentPlanSlipDto> CancelServiceAsync(Guid id, Guid serviceLineId);
    Task<TreatmentPlanSlipDto> ReorderServiceAsync(Guid id, ReorderTreatmentServiceDto input);

    Task<TreatmentPlanSlipDto> ConvertServiceAsync(
        Guid id, Guid serviceLineId, ConvertTreatmentServiceDto input);

    /// <summary>
    /// "Hủy phiếu Labo" on the Chuyển đổi dialog: closes every unfinished labo
    /// order of the line so it can be cancelled or converted.
    /// </summary>
    Task<TreatmentPlanSlipDto> CancelServiceLaboOrdersAsync(Guid id, Guid serviceLineId);

    /// <summary>In phiếu điều trị.</summary>
    Task<byte[]> ExportPdfAsync(Guid id);
}

/// <summary>
/// Thanh toán của bệnh nhân — thu tiền, hoàn tiền, giữ hộ.
/// </summary>
/// <summary>
/// The six movements the reference's "BE:Perm:BalanceHistory" knows, with its own
/// wording. Read off its published bundle 2026-09-22:
/// <c>{topup, use, withdraw, replace, refund, cancel}</c>.
/// </summary>
public enum DebtMovementType
{
    /// <summary>Nạp dư nợ — money put on the patient's account.</summary>
    Topup = 1,

    /// <summary>Sử dụng dư nợ — a slip settled out of that account.</summary>
    Use = 2,

    /// <summary>
    /// Rút dư nợ. No BlueDental operation pays the held balance back out in
    /// cash, so nothing writes this yet — see docs/clone/unknowns.md.
    /// </summary>
    Withdraw = 3,

    /// <summary>Thay thế dịch vụ — what a conversion left on the closed line.</summary>
    Replace = 4,

    /// <summary>Hoàn trả dư nợ — money refunded to the patient.</summary>
    Refund = 5,

    /// <summary>Huỷ dịch vụ - Cộng dư nợ — a cancelled line gives its money back.</summary>
    Cancel = 6
}

/// <summary>One line of "BE:Perm:BalanceHistory".</summary>
public class DebtHistoryEntryDto
{
    public Guid Id { get; set; }
    public DateTimeOffset Date { get; set; }
    public DebtMovementType Type { get; set; }

    /// <summary>
    /// The size of the movement; which way it goes is read off the type, the
    /// way the reference's own table does it. <see cref="DebtMovementType.Replace"/>
    /// is the one type that can go either way, and only it is ever negative.
    /// </summary>
    public decimal Amount { get; set; }

    public string? Note { get; set; }
    public string? StaffName { get; set; }
}

public class GetDebtHistoryInput : PagedAndSortedResultRequestDto
{
    public Guid PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}

public interface IPatientPaymentAppService : IApplicationService
{
    Task<PagedResultDto<PatientPaymentDto>> GetListAsync(GetPatientPaymentListInput input);
    Task<PatientAccountDto> GetAccountAsync(Guid patientId, Guid? clinicBranchId = null);
    Task<PatientPaymentDto> RecordAsync(RecordPatientPaymentDto input);
    Task<PatientPaymentDto> UpdateAsync(Guid id, UpdatePatientPaymentDto input);
    Task<PagedResultDto<DebtHistoryEntryDto>> GetDebtHistoryAsync(GetDebtHistoryInput input);
    Task DeleteAsync(Guid id);
}
