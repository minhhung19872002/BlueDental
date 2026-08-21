using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Reporting;

[Authorize(BlueDentalPermissions.Reporting.View)]
public class ReportAppService : ApplicationService, IReportAppService
{
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<Invoice, Guid> _invoiceRepository;

    public ReportAppService(
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<Invoice, Guid> invoiceRepository)
    {
        _appointmentRepository = appointmentRepository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<AppointmentSummaryReportDto> GetAppointmentSummaryAsync(ReportQueryDto input)
    {
        var query = await _appointmentRepository.GetQueryableAsync();
        var fromDate = input.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = input.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        query = query.Where(a => a.Slot.Start >= fromDate && a.Slot.Start <= toDate);

        if (input.BranchId.HasValue) query = query.Where(a => a.BranchId == input.BranchId.Value);

        var total = query.Count();
        var completed = query.Count(a => a.Status == AppointmentStatus.Completed);
        var cancelled = query.Count(a => a.Status == AppointmentStatus.Cancelled);
        var noShow = query.Count(a => a.Status == AppointmentStatus.NoShow);

        return new AppointmentSummaryReportDto
        {
            TotalAppointments = total,
            Completed = completed,
            Cancelled = cancelled,
            NoShow = noShow,
            CompletionRate = total > 0 ? (decimal)completed / total * 100 : 0
        };
    }

    public async Task<RevenueReportDto> GetRevenueReportAsync(ReportQueryDto input)
    {
        var query = await _invoiceRepository.GetQueryableAsync();

        if (input.BranchId.HasValue) query = query.Where(i => i.BranchId == input.BranchId.Value);

        var invoices = query.ToList();

        return new RevenueReportDto
        {
            TotalRevenue = invoices.Sum(i => i.TotalAmount.Amount),
            TotalPaid = invoices.Sum(i => i.PaidAmount.Amount),
            TotalOutstanding = invoices.Sum(i => i.BalanceDue.Amount),
            Currency = "USD"
        };
    }
}
