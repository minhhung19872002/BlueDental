using System;
using System.Collections.Generic;

namespace BlueDental.Reporting;

public class ReportQueryDto
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    public Guid? BranchId { get; set; }
    public ReportPeriod Period { get; set; } = ReportPeriod.Monthly;
}

public class AppointmentSummaryReportDto
{
    public int TotalAppointments { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
    public decimal CompletionRate { get; set; }
}

public class RevenueReportDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalOutstanding { get; set; }
    public string Currency { get; set; } = "USD";
}

public class ExpenseLineItemDto
{
    public Guid Id { get; set; }
    public string Date { get; set; } = default!;
    public string PatientName { get; set; } = default!;
    public string? CounselorName { get; set; }
    public string? DoctorName { get; set; }
    public string? ServiceName { get; set; }
    public int Quantity { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
}

public class ExpenseReportResultDto
{
    public List<ExpenseLineItemDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public decimal GrandTotalAmount { get; set; }
    public decimal GrandPaidAmount { get; set; }
}
