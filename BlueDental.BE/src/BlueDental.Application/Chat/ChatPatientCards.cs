using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;
using Volo.Abp.Timing;

namespace BlueDental.Chat;

/// <summary>
/// The patient side of # tags (R-1161): the cards under messages and the
/// suggestions while typing. Cards are built when read — always the latest —
/// in one batch per page. Nothing here ever reads the phone number, medical
/// history, allergies or diagnosis. The caller checks membership first and
/// passes the conversation's branch.
/// </summary>
public class ChatPatientCards(
    IRepository<Patient, Guid> patients,
    IRepository<Appointment, Guid> appointments,
    IIdentityUserRepository userRepository,
    IAsyncQueryableExecuter asyncExecuter,
    IClock clock) : ITransientDependency
{
    private sealed record PatientRow(Guid Id, string LastName, string FirstName, string PatientCode, DateOnly? DateOfBirth)
    {
        public string Name
        {
            get
            {
                var name = $"{LastName} {FirstName}".Trim();
                return name.Length > 0 ? name : PatientCode;
            }
        }
    }

    private sealed record VisitRow(
        Guid PatientId,
        Guid DentistId,
        DateTimeOffset Start,
        AppointmentStatus Status,
        DateTimeOffset? CheckedInAt,
        string? ChiefComplaint);

    /// <summary>
    /// One list of cards per id list, in the same order. <paramref name="canView"/>
    /// is the viewer's Patients.View: without it only the name and Mã KH are filled.
    /// </summary>
    public async Task<List<List<ChatPatientCardDto>>> BuildAsync(
        Guid branchId, IReadOnlyList<IReadOnlyList<Guid>> patientIdLists, bool canView)
    {
        var ids = patientIdLists.SelectMany(l => l).Distinct().ToList();
        if (ids.Count == 0)
        {
            return patientIdLists.Select(_ => new List<ChatPatientCardDto>()).ToList();
        }

        var found = (await PatientsAsync(branchId, q => q.Where(p => ids.Contains(p.Id)))).ToDictionary(p => p.Id);
        var visits = canView ? await TodayVisitsAsync(branchId, found.Keys.ToList()) : [];
        var dentists = await DentistNamesAsync(visits.Values.Select(v => v.DentistId));

        return patientIdLists.Select(list => list.Select(id =>
        {
            if (!found.TryGetValue(id, out var patient))
            {
                return new ChatPatientCardDto { Id = id, Missing = true };
            }

            var card = new ChatPatientCardDto { Id = id, Name = patient.Name, PatientCode = patient.PatientCode };
            if (!canView)
            {
                return card;
            }

            card.CanOpen = true;
            card.YearOfBirth = patient.DateOfBirth?.Year;
            if (visits.TryGetValue(id, out var visit))
            {
                card.AppointmentAt = visit.Start;
                card.DentistName = dentists.GetValueOrDefault(visit.DentistId);
                card.VisitStatus = StatusOf(visit);
                card.BookingContent = visit.ChiefComplaint;
            }

            return card;
        }).ToList()).ToList();
    }

    /// <summary>
    /// Today's patients first (by their time), then the rest of the branch by
    /// name; empty text lists today's patients only. Name or Mã KH, accent-blind.
    /// </summary>
    public async Task<List<ChatPatientSuggestionDto>> SuggestAsync(Guid branchId, string? text)
    {
        var filter = Regex.Replace(text?.Trim() ?? "", @"\s+", " ").ToLowerInvariant();
        var (dayStart, dayEnd) = Today();
        var todayIds = await asyncExecuter.ToListAsync(TodayQuery(await appointments.GetQueryableAsync(), branchId, dayStart, dayEnd)
            .Select(a => a.PatientId)
            .Distinct());

        Func<IQueryable<Patient>, IQueryable<Patient>> matching = filter.Length == 0
            ? q => q
            : q => q.Where(p =>
                DbText.Unaccent((p.LastName + " " + p.FirstName).ToLower()).Contains(DbText.Unaccent(filter))
                || p.PatientCode.ToLower().Contains(filter));

        var today = todayIds.Count == 0
            ? []
            : await PatientsAsync(branchId, q => matching(q.Where(p => todayIds.Contains(p.Id))));
        var visits = await TodayVisitsAsync(branchId, today.Select(p => p.Id).ToList());
        var result = today
            .OrderBy(p => visits.TryGetValue(p.Id, out var v) ? v.Start : DateTimeOffset.MaxValue)
            .ThenBy(p => p.Name)
            .Take(ChatConsts.MaxPatientSuggestions)
            .Select(p => Suggestion(p, visits.GetValueOrDefault(p.Id), isToday: true))
            .ToList();

        var room = ChatConsts.MaxPatientSuggestions - result.Count;
        if (filter.Length > 0 && room > 0)
        {
            var taken = result.Select(r => r.Id).ToList();
            var others = await PatientsAsync(branchId, q => matching(q.Where(p => !taken.Contains(p.Id)))
                .OrderBy(p => p.LastName + " " + p.FirstName)
                .ThenBy(p => p.PatientCode)
                .Take(room));
            result.AddRange(others.Select(p => Suggestion(p, null, isToday: false)));
        }

        return result;
    }

    private static ChatPatientSuggestionDto Suggestion(PatientRow patient, VisitRow? visit, bool isToday) => new()
    {
        Id = patient.Id,
        Name = patient.Name,
        PatientCode = patient.PatientCode,
        YearOfBirth = patient.DateOfBirth?.Year,
        TodayAt = visit?.Start,
        IsToday = isToday,
    };

    private async Task<List<PatientRow>> PatientsAsync(Guid branchId, Func<IQueryable<Patient>, IQueryable<Patient>> shape)
    {
        var query = shape((await patients.GetQueryableAsync()).Where(p => p.BranchId == branchId));
        return await asyncExecuter.ToListAsync(
            query.Select(p => new PatientRow(p.Id, p.LastName, p.FirstName, p.PatientCode, p.DateOfBirth)));
    }

    /// <summary>
    /// Each patient's visit today: the earliest still standing, else the
    /// earliest cancelled one. Temporary bookings (Lịch tạm) have no record yet.
    /// </summary>
    private async Task<Dictionary<Guid, VisitRow>> TodayVisitsAsync(Guid branchId, List<Guid> patientIds)
    {
        if (patientIds.Count == 0)
        {
            return [];
        }

        var (dayStart, dayEnd) = Today();
        var rows = await asyncExecuter.ToListAsync(
            TodayQuery(await appointments.GetQueryableAsync(), branchId, dayStart, dayEnd)
                .Where(a => patientIds.Contains(a.PatientId))
                .Select(a => new VisitRow(a.PatientId, a.DentistId, a.Slot.Start, a.Status, a.CheckedInAt, a.ChiefComplaint)));

        return rows
            .GroupBy(v => v.PatientId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(v => v.Status == AppointmentStatus.Cancelled).ThenBy(v => v.Start).First());
    }

    /// <summary>Booked for today, or checked in today (clinic day).</summary>
    private static IQueryable<Appointment> TodayQuery(
        IQueryable<Appointment> query, Guid branchId, DateTimeOffset dayStart, DateTimeOffset dayEnd) =>
        query.Where(a => a.BranchId == branchId && !a.IsTemporary
            && ((a.Slot.Start >= dayStart && a.Slot.Start < dayEnd)
                || (a.CheckedInAt != null && a.CheckedInAt >= dayStart && a.CheckedInAt < dayEnd)));

    private (DateTimeOffset Start, DateTimeOffset End) Today()
    {
        var day = ClinicCalendar.DateOf(new DateTimeOffset(clock.Now.ToUniversalTime(), TimeSpan.Zero));
        return (ClinicCalendar.StartOfDay(day), ClinicCalendar.StartOfDay(day.AddDays(1)));
    }

    /// <summary>The Tiếp nhận wording: an unseen booking past its time is late.</summary>
    private ChatPatientVisitStatus StatusOf(VisitRow visit) => visit.Status switch
    {
        AppointmentStatus.CheckedIn => ChatPatientVisitStatus.Arrived,
        AppointmentStatus.InProgress => ChatPatientVisitStatus.InTreatment,
        AppointmentStatus.Completed => ChatPatientVisitStatus.Completed,
        AppointmentStatus.Cancelled => ChatPatientVisitStatus.Cancelled,
        AppointmentStatus.NoShow => ChatPatientVisitStatus.Late,
        _ when visit.CheckedInAt is not null => ChatPatientVisitStatus.Arrived,
        _ when visit.Start < new DateTimeOffset(clock.Now.ToUniversalTime(), TimeSpan.Zero) => ChatPatientVisitStatus.Late,
        _ => ChatPatientVisitStatus.Scheduled,
    };

    private async Task<Dictionary<Guid, string>> DentistNamesAsync(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return distinct.Count == 0
            ? []
            : (await userRepository.GetListByIdsAsync(distinct)).ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }
}
