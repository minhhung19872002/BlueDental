using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Timing;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// What each of the 16 fixed variables (<see cref="MessageVariables"/>) reads
/// for a customer, inside one branch: the send goes out from that branch, so
/// its appointments, treatment steps and money are the ones a message speaks
/// of. Built for a whole list at once — every lookup is one query per kind,
/// never one per customer.
///
/// A value the customer has no data for comes back null; what that means for
/// the send (fallback text or leave the customer out) is the variable's
/// <see cref="MessageVariable.WhenEmpty"/>, decided by the caller.
/// </summary>
public class MessageVariableResolver : ITransientDependency
{
    private static readonly CultureInfo Vietnamese = new("vi-VN");

    /// <summary>Message text for Vietnamese customers, not interface text.</summary>
    private static readonly string[] Weekdays =
        ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

    /// <summary>Appointments still going ahead.</summary>
    internal static readonly AppointmentStatus[] Upcoming =
    [
        AppointmentStatus.Requested, AppointmentStatus.Confirmed,
        AppointmentStatus.CheckedIn, AppointmentStatus.InProgress,
    ];

    private readonly IRepository<Appointment, Guid> _appointments;
    private readonly IRepository<TreatmentStage, Guid> _stages;
    private readonly IRepository<TreatmentPlan, Guid> _plans;
    private readonly IRepository<PatientPayment, Guid> _payments;
    private readonly IRepository<CatalogEntry, Guid> _catalog;
    private readonly IRepository<ClinicBranch, Guid> _branches;
    private readonly IIdentityUserRepository _users;
    private readonly PatientMoneyCalculator _money;
    private readonly IClock _clock;

    public MessageVariableResolver(
        IRepository<Appointment, Guid> appointments,
        IRepository<TreatmentStage, Guid> stages,
        IRepository<TreatmentPlan, Guid> plans,
        IRepository<PatientPayment, Guid> payments,
        IRepository<CatalogEntry, Guid> catalog,
        IRepository<ClinicBranch, Guid> branches,
        IIdentityUserRepository users,
        PatientMoneyCalculator money,
        IClock clock)
    {
        _appointments = appointments;
        _stages = stages;
        _plans = plans;
        _payments = payments;
        _catalog = catalog;
        _branches = branches;
        _users = users;
        _money = money;
        _clock = clock;
    }

    /// <summary>
    /// The values for each patient. <paramref name="appointmentOf"/> pins the
    /// appointment a message is about (a "Nhắc lịch hẹn" row names its own);
    /// any other patient's appointment variables read their next visit.
    /// </summary>
    public async Task<IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, string?>>> ResolveAsync(
        Guid branchId,
        IReadOnlyCollection<Patient> patients,
        IReadOnlyDictionary<Guid, Guid>? appointmentOf = null)
    {
        var result = new Dictionary<Guid, IReadOnlyDictionary<string, string?>>();
        if (patients.Count == 0)
        {
            return result;
        }

        var ids = patients.Select(p => p.Id).ToHashSet();
        var branch = await _branches.FindAsync(branchId);
        var visits = await LoadVisitsAsync(branchId, ids, appointmentOf);
        var treatments = await LoadLatestTreatmentsAsync(branchId, ids);
        var debts = await LoadDebtsAsync(branchId, ids);
        var dentists = await NamesOfStaffAsync(visits.Values.Select(a => a.DentistId).ToHashSet());
        var services = await NamesOfServicesAsync(treatments.Values.Select(s => s.ServiceId).ToHashSet());

        foreach (var patient in patients)
        {
            var visit = visits.GetValueOrDefault(patient.Id);
            var stage = treatments.GetValueOrDefault(patient.Id);
            var values = new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                [MessageVariables.CustomerName] = Blank(patient.FullName),
                [MessageVariables.Salutation] = SalutationOf(patient.Gender),
                [MessageVariables.CustomerCode] = Blank(patient.PatientCode),
                [MessageVariables.Phone] = Blank(patient.Contact?.PhoneNumber),
                [MessageVariables.Email] = Blank(patient.Contact?.Email),
                [MessageVariables.BirthDate] = patient.DateOfBirth?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                [MessageVariables.TreatmentDate] = stage?.TreatmentDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                [MessageVariables.TreatmentService] = stage == null
                    ? null
                    : Blank(services.GetValueOrDefault(stage.ServiceId)) ?? Blank(stage.Name),
                [MessageVariables.Debt] = Money(debts.GetValueOrDefault(patient.Id)),
                [MessageVariables.ClinicName] = Blank(branch?.Name),
                [MessageVariables.Hotline] = Blank(branch?.PhoneNumber),
            };
            AddVisit(values, visit, visit == null ? null : dentists.GetValueOrDefault(visit.DentistId));
            result[patient.Id] = values;
        }

        return result;
    }

    private static void AddVisit(Dictionary<string, string?> values, Appointment? visit, string? dentist)
    {
        if (visit == null)
        {
            values[MessageVariables.AppointmentDate] = null;
            values[MessageVariables.AppointmentTime] = null;
            values[MessageVariables.AppointmentWeekday] = null;
            values[MessageVariables.AppointmentContent] = null;
            values[MessageVariables.Dentist] = null;
            return;
        }

        var local = ClinicCalendar.ToLocal(visit.Slot.Start);
        values[MessageVariables.AppointmentDate] = local.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        values[MessageVariables.AppointmentTime] = local.ToString("HH:mm", CultureInfo.InvariantCulture);
        values[MessageVariables.AppointmentWeekday] = Weekdays[(int)local.DayOfWeek];
        values[MessageVariables.AppointmentContent] = Blank(visit.ChiefComplaint);
        // The library's example reads "BS. Trần Minh": the title travels with the name.
        values[MessageVariables.Dentist] = dentist == null ? null : "BS. " + dentist;
    }

    /// <summary>
    /// The pinned appointment when there is one, else the earliest visit from
    /// today on that is still going ahead. A held "Lịch tạm" slot is not a visit yet.
    /// </summary>
    private async Task<Dictionary<Guid, Appointment>> LoadVisitsAsync(
        Guid branchId, HashSet<Guid> ids, IReadOnlyDictionary<Guid, Guid>? appointmentOf)
    {
        var query = await _appointments.GetQueryableAsync();
        var result = new Dictionary<Guid, Appointment>();

        var pinnedIds = appointmentOf?
            .Where(p => ids.Contains(p.Key))
            .Select(p => p.Value)
            .ToHashSet() ?? [];
        if (pinnedIds.Count > 0)
        {
            foreach (var appointment in query.Where(a => pinnedIds.Contains(a.Id) && a.BranchId == branchId).ToList())
            {
                result[appointment.PatientId] = appointment;
            }
        }

        var from = ClinicCalendar.StartOfDay(ClinicCalendar.DateOf(_clock.Now));
        var open = ids.Where(id => !result.ContainsKey(id)).ToHashSet();
        if (open.Count == 0)
        {
            return result;
        }

        var upcoming = query
            .Where(a => a.BranchId == branchId && open.Contains(a.PatientId))
            .Where(a => !a.IsTemporary && Upcoming.Contains(a.Status) && a.Slot.Start >= from)
            .ToList();
        foreach (var group in upcoming.GroupBy(a => a.PatientId))
        {
            result[group.Key] = group.OrderBy(a => a.Slot.Start).First();
        }

        return result;
    }

    /// <summary>The newest step a doctor started or finished; a step later redone does not count.</summary>
    private async Task<Dictionary<Guid, TreatmentStage>> LoadLatestTreatmentsAsync(Guid branchId, HashSet<Guid> ids)
    {
        var query = await _stages.GetQueryableAsync();
        return query
            .Where(s => s.ClinicBranchId == branchId && ids.Contains(s.PatientId))
            .Where(s => !s.IsSuperseded && s.Status != TreatmentStageStatus.Pending)
            .ToList()
            .GroupBy(s => s.PatientId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(s => s.TreatmentDate).ThenByDescending(s => s.CreationTime).First());
    }

    /// <summary>"Công nợ" as the patient list counts it: the live slips' Còn nợ, never below zero.</summary>
    private async Task<Dictionary<Guid, decimal>> LoadDebtsAsync(Guid branchId, HashSet<Guid> ids)
    {
        // WithDetails: the slip's money reads its service lines.
        var planQuery = await _plans.WithDetailsAsync(p => p.Services);
        var plans = planQuery
            .Where(p => p.BranchId == branchId && ids.Contains(p.PatientId))
            .Where(p => p.Status != TreatmentPlanStatus.Cancelled)
            .ToList()
            .ToLookup(p => p.PatientId);
        var paymentQuery = await _payments.GetQueryableAsync();
        var payments = paymentQuery
            .Where(p => p.ClinicBranchId == branchId && ids.Contains(p.PatientId))
            .ToList()
            .ToLookup(p => p.PatientId);

        return ids.ToDictionary(id => id, id =>
        {
            var due = _money.ForPatient(plans[id].ToList(), payments[id].ToList()).TotalDue;
            return due > 0m ? due : 0m;
        });
    }

    private async Task<Dictionary<Guid, string>> NamesOfStaffAsync(HashSet<Guid> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _users.GetListByIdsAsync(ids.ToList());
        return users.ToDictionary(u => u.Id, u =>
        {
            var full = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(full) ? u.UserName : full;
        });
    }

    private async Task<Dictionary<Guid, string>> NamesOfServicesAsync(HashSet<Guid> ids)
    {
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _catalog.GetQueryableAsync();
        return query
            .Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.Name })
            .ToList()
            .ToDictionary(c => c.Id, c => c.Name);
    }

    /// <summary>"Anh"/"Chị" from the record; anyone else gets the variable's fallback.</summary>
    private static string? SalutationOf(Gender gender) => gender switch
    {
        Gender.Male => "Anh",
        Gender.Female => "Chị",
        _ => null,
    };

    /// <summary>"2.500.000đ", as the library's example writes it.</summary>
    private static string Money(decimal amount) =>
        decimal.Round(amount, 0).ToString("#,0", Vietnamese) + "đ";

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
