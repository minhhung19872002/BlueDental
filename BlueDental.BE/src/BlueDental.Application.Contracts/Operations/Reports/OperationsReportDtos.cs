using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations.Reports;

/// <summary>
/// The window a Vận hành report is read through.
///
/// The reference puts Ngày / Tuần / Tháng / Năm above every report with a
/// date stepper beside it, so a report is always "this one day", "this one
/// week", and so on — never an open range the caller composes itself.
/// </summary>
public enum OperationsReportPeriod
{
    Day = 1,
    Week = 2,
    Month = 3,
    Year = 4
}

/// <summary>What a row of the work log records.</summary>
public enum WorkLogAction
{
    Diagnosis = 1,
    Consultation = 2,
    Treatment = 3,
    Stage = 4,
    FollowUp = 5,
    Payment = 6,
    Refund = 7,
    ServiceCancelled = 8,
    ServiceConverted = 9,
    Appointment = 10,
    Reception = 11
}

/// <summary>
/// Which slice of the sales list to read — the reference's "Phân loại" select,
/// whose three options are the same three figures it shows as cards.
/// </summary>
public enum SalesCategory
{
    Total = 1,
    Completed = 2,
    OwnQuota = 3
}

/// <summary>Common to every report: the branch, the window, and paging.</summary>
public class OperationsReportInput : PagedAndSortedResultRequestDto
{
    /// <summary>Empty reads whatever branches the caller may see.</summary>
    public Guid? ClinicBranchId { get; set; }

    public OperationsReportPeriod Period { get; set; } = OperationsReportPeriod.Month;

    /// <summary>Any date inside the window; the server squares it to the period.</summary>
    public DateTime Anchor { get; set; }

    /// <summary>Free text, trimmed and case-insensitive, where the report has a search.</summary>
    public string? Filter { get; set; }
}

public class WorkLogInput : OperationsReportInput
{
    /// <summary>Empty means every action.</summary>
    public List<WorkLogAction> Actions { get; set; } = [];
}

public class ServiceCompletionInput : OperationsReportInput
{
    public Guid? DentistId { get; set; }
    public Guid? ServiceGroupId { get; set; }
}

public class SalesAccessInput : OperationsReportInput
{
    public SalesCategory Category { get; set; } = SalesCategory.Total;
}

/// <summary>One line of Báo cáo — who did what to whom, and what it was worth.</summary>
public class WorkLogRowDto
{
    public DateTime OccurredAt { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    public WorkLogAction Action { get; set; }
    /// <summary>Điều trị / Dịch vụ / Lịch hẹn — whichever the action points at.</summary>
    public string Subject { get; set; } = string.Empty;
    public string? Note { get; set; }
    public decimal Amount { get; set; }
}

/// <summary>A diagnosis nobody has turned into treatment yet.</summary>
public class UntreatedDiagnosisRowDto
{
    public DateTime DiagnosedAt { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    /// <summary>FDI numbers, already joined for display.</summary>
    public string Teeth { get; set; } = string.Empty;
    public string DiagnosisName { get; set; } = string.Empty;
    public string? Note { get; set; }
}

/// <summary>One consultant's month, as Khách hàng phát sinh counts it.</summary>
public class ConsultantSummaryRowDto
{
    public Guid StaffId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public int NewPatientConsultations { get; set; }
    public int ReturningPatientConsultations { get; set; }
    public decimal NewPatientRevenue { get; set; }
    public decimal ReturningPatientRevenue { get; set; }
    public int TotalConsultations { get; set; }
    public decimal TotalRevenue { get; set; }
}

public class InvoiceReportRowDto
{
    public DateTime CreatedAt { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    /// <summary>Tên đơn vị — the branch that issued it.</summary>
    public string UnitName { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    /// <summary>Trạng thái hóa đơn — whether it has been issued to the tax office.</summary>
    public string IssueStatus { get; set; } = string.Empty;
    /// <summary>Trạng thái — where the money has got to.</summary>
    public string Status { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string? Supplier { get; set; }
}

/// <summary>
/// A service line as the two money screens show it — Hoàn thành theo dịch vụ
/// and Truy cập read the same rows through different columns.
/// </summary>
public class ServiceLineRowDto
{
    public Guid Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime PatientCreatedAt { get; set; }
    public string? Occupation { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string? DetailName { get; set; }
    public string ServiceGroupName { get; set; } = string.Empty;
    /// <summary>Dịch vụ đã hoàn thành / Dịch vụ tính doanh số riêng.</summary>
    public SalesCategory Classification { get; set; }
    public string SyncStatus { get; set; } = string.Empty;
    public string InvoiceStatus { get; set; } = string.Empty;
    public string? DiagnosingDentistName { get; set; }
    public string? SecondDiagnosisName { get; set; }
    public string? ConsultantName { get; set; }
    public string? SecondConsultantName { get; set; }
    public string? TreatingDentistName { get; set; }
    public string? SupportingDentistName { get; set; }
    public string? AssistantName { get; set; }
    public string Teeth { get; set; } = string.Empty;
    public string? ServiceNote { get; set; }
    public string? TreatmentContent { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DoctorAmount { get; set; }
    public string? StageName { get; set; }
    public string? TaxKind { get; set; }
    public decimal? TaxPercent { get; set; }
}

/// <summary>The figures above Hoàn thành theo dịch vụ.</summary>
public class ServiceCompletionStatsDto
{
    public decimal ActualCollected { get; set; }
    public decimal TotalRevenue { get; set; }
    /// <summary>Against the same window one period earlier; null when there is nothing to compare.</summary>
    public decimal? RevenueChangePercent { get; set; }
    public decimal AdvanceRevenue { get; set; }
    public decimal CompletedServices { get; set; }
    public decimal OnScheduePercent { get; set; }
    public decimal OwnQuotaServices { get; set; }
}

/// <summary>The three figures above Truy cập, which are also its filter.</summary>
public class SalesAccessStatsDto
{
    public decimal TotalSales { get; set; }
    public decimal CompletedServices { get; set; }
    public decimal OwnQuotaServices { get; set; }
}

public class ServiceCompletionResultDto : PagedResultDto<ServiceLineRowDto>
{
    public ServiceCompletionStatsDto Stats { get; set; } = new();
}

public class SalesAccessResultDto : PagedResultDto<ServiceLineRowDto>
{
    public SalesAccessStatsDto Stats { get; set; } = new();
}
