using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Reporting;

[Authorize(BlueDentalPermissions.Reporting.View)]
public class ReportAppService : ApplicationService, IReportAppService
{
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<Invoice, Guid> _invoiceRepository;
    private readonly IRepository<TreatmentRecord, Guid> _treatmentRecordRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<DentalProcedure, Guid> _procedureRepository;
    private readonly IIdentityUserRepository _userRepository;

    public ReportAppService(
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<Invoice, Guid> invoiceRepository,
        IRepository<TreatmentRecord, Guid> treatmentRecordRepository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<DentalProcedure, Guid> procedureRepository,
        IIdentityUserRepository userRepository)
    {
        _appointmentRepository = appointmentRepository;
        _invoiceRepository = invoiceRepository;
        _treatmentRecordRepository = treatmentRecordRepository;
        _patientRepository = patientRepository;
        _procedureRepository = procedureRepository;
        _userRepository = userRepository;
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

    public async Task<ExpenseReportResultDto> GetExpenseLineItemsAsync(ReportQueryDto input)
    {
        var fromDate = input.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = input.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var treatmentQuery = await _treatmentRecordRepository.GetQueryableAsync();
        treatmentQuery = treatmentQuery.Where(t => t.PerformedAt >= fromDate && t.PerformedAt <= toDate);

        var treatments = treatmentQuery.OrderByDescending(t => t.PerformedAt).ToList();
        if (treatments.Count == 0)
        {
            return new ExpenseReportResultDto();
        }

        var patientIds = treatments.Select(t => t.PatientId).Distinct().ToList();
        var dentistIds = treatments.Select(t => t.DentistId).Distinct().ToList();
        var procedureIds = treatments.Where(t => t.ProcedureId.HasValue).Select(t => t.ProcedureId!.Value).Distinct().ToList();
        var appointmentIds = treatments.Select(t => t.AppointmentId).Distinct().ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery.Where(p => patientIds.Contains(p.Id))
            .Select(p => new { p.Id, p.FirstName, p.LastName }).ToList()
            .ToDictionary(p => p.Id, p => $"{p.FirstName} {p.LastName}");

        var dentists = (await _userRepository.GetListAsync()).Where(u => dentistIds.Contains(u.Id))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName ?? "");

        var procedureQuery = await _procedureRepository.GetQueryableAsync();
        var procedures = procedureIds.Count > 0
            ? procedureQuery.Where(p => procedureIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name }).ToList()
                .ToDictionary(p => p.Id, p => p.Name)
            : new Dictionary<Guid, string>();

        var invoiceQuery = await _invoiceRepository.GetQueryableAsync();
        var invoicesByAppointment = invoiceQuery
            .Where(i => i.AppointmentId.HasValue && appointmentIds.Contains(i.AppointmentId!.Value))
            .ToList()
            .GroupBy(i => i.AppointmentId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var items = treatments.Select(t =>
        {
            invoicesByAppointment.TryGetValue(t.AppointmentId, out var invoice);
            patients.TryGetValue(t.PatientId, out var patientName);
            dentists.TryGetValue(t.DentistId, out var doctorName);
            var serviceName = t.ProcedureId.HasValue && procedures.TryGetValue(t.ProcedureId.Value, out var pName) ? pName : null;

            return new ExpenseLineItemDto
            {
                Id = t.Id,
                Date = t.PerformedAt.ToString("yyyy-MM-dd"),
                PatientName = patientName ?? "—",
                CounselorName = null,
                DoctorName = doctorName,
                ServiceName = serviceName,
                Quantity = 1,
                TotalAmount = t.ChargedAmount ?? 0,
                PaidAmount = invoice?.PaidAmount.Amount ?? 0,
            };
        }).ToList();

        return new ExpenseReportResultDto
        {
            Items = items,
            TotalCount = items.Count,
            GrandTotalAmount = items.Sum(i => i.TotalAmount),
            GrandPaidAmount = items.Sum(i => i.PaidAmount),
        };
    }
}
