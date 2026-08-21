using System;

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
