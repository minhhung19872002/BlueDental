using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Appointments;

[Authorize]
public class AppointmentAppService : ApplicationService, IAppointmentAppService
{
    private readonly IRepository<Appointment, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<DentalProcedure, Guid> _procedureRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly AppointmentConflictChecker _conflictChecker;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly AppointmentChangeRecorder _changeRecorder;
    private readonly DentistShiftChecker _shiftChecker;
    private readonly DoctorTeamLookup _doctorTeams;

    public AppointmentAppService(
        IRepository<Appointment, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<DentalProcedure, Guid> procedureRepository,
        IIdentityUserRepository userRepository,
        AppointmentConflictChecker conflictChecker,
        ICurrentClinicBranchResolver branchResolver,
        AppointmentChangeRecorder changeRecorder,
        DentistShiftChecker shiftChecker,
        DoctorTeamLookup doctorTeams)
    {
        _doctorTeams = doctorTeams;
        _changeRecorder = changeRecorder;
        _shiftChecker = shiftChecker;
        _repository = repository;
        _patientRepository = patientRepository;
        _procedureRepository = procedureRepository;
        _userRepository = userRepository;
        _conflictChecker = conflictChecker;
        _branchResolver = branchResolver;
    }

    /// <summary>The one <c>Sorting</c> the list honours: latest visit first.</summary>
    private const string NewestFirst = "Start desc";

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<PagedResultDto<AppointmentDto>> GetListAsync(GetAppointmentListInput input)
    {
        var query = await FilteredQueryAsync(input);
        var totalCount = await AsyncExecuter.CountAsync(query);

        var hasDateFilter = input.Date.HasValue || input.FromDate.HasValue || input.ToDate.HasValue;

        // A patient's record asks for its latest visits first ("Start desc"),
        // since a clinic's moved-in history reaches back years.
        var newestFirst = string.Equals(input.Sorting?.Trim(), NewestFirst, StringComparison.OrdinalIgnoreCase);
        // TEMP-PRIORITY-OFF (owner, 2026-10-17): several doctors picked on the
        // board no longer come grouped by their "Mức độ ưu tiên" — start time,
        // like one doctor; the board then lifts "Đang khám" and drops "Hoàn tất"
        // itself (BA, R-978/R-979). To bring the grouping back, put these lines
        // back in place of `ordered` below and uncomment DentistPriorityAsync.
        // var priority = await DentistPriorityAsync(input);
        // var ordered = priority.Count > 1
        //     ? query.OrderBy(DentistPriorityOrder.RankOf(priority)).ThenBy(a => a.Slot.Start).ThenBy(a => a.Id)
        //     : newestFirst
        //         ? query.OrderByDescending(a => a.Slot.Start).ThenByDescending(a => a.Id)
        //         : query.OrderBy(a => a.Slot.Start).ThenBy(a => a.Id);
        var ordered = newestFirst
            ? query.OrderByDescending(a => a.Slot.Start).ThenByDescending(a => a.Id)
            : query.OrderBy(a => a.Slot.Start).ThenBy(a => a.Id);

        var items = hasDateFilter
            ? await AsyncExecuter.ToListAsync(ordered)
            : await AsyncExecuter.ToListAsync(
                ordered.Skip(input.SkipCount).Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<Appointment>, List<AppointmentDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<AppointmentDto>(totalCount, dtos);
    }

    // TEMP-PRIORITY-OFF (owner, 2026-10-17): unused while the board ignores
    // the doctors' "Mức độ ưu tiên" — see GetListAsync.
    // /// <summary>
    // /// Several doctors on the board — picked one by one or as a Nhóm bác sĩ:
    // /// their visits come by each doctor's "Mức độ ưu tiên" on the staff form,
    // /// whatever order the request named them in.
    // /// </summary>
    // private async Task<List<Guid>> DentistPriorityAsync(GetAppointmentListInput input)
    // {
    //     var dentistIds = input.DentistIds is { Count: > 1 }
    //         ? input.DentistIds.Distinct().ToList()
    //         : input.DoctorTeamId.HasValue
    //             ? await _doctorTeams.GetMemberIdsAsync(input.DoctorTeamId.Value)
    //             : [];
    //     if (dentistIds.Count < 2) return dentistIds;
    //
    //     var ranked = StaffPriority.Order(await _userRepository.GetListByIdsAsync(dentistIds))
    //         .Select(u => u.Id)
    //         .ToList();
    //     // An id with no account behind it any more goes last.
    //     return [.. ranked, .. dentistIds.Except(ranked)];
    // }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<AppointmentStatsDto> GetStatsAsync(GetAppointmentListInput input)
    {
        var query = await FilteredQueryAsync(input, skipTextSearch: true);
        var now = DateTimeOffset.UtcNow;

        // Counted in the database: with no date window the query spans every
        // visit of the branch, years of them once an old system is moved in.
        var byStatus = (await AsyncExecuter.ToListAsync(query
                .GroupBy(a => a.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })))
            .ToDictionary(g => g.Status, g => g.Count);
        var temporary = await AsyncExecuter.CountAsync(query.Where(a => a.IsTemporary));
        var overdue = await AsyncExecuter.CountAsync(query.Where(a =>
            (a.Status == AppointmentStatus.Requested || a.Status == AppointmentStatus.Confirmed)
            && a.Slot.Start <= now));

        return new AppointmentStatsDto
        {
            Requested = byStatus.GetValueOrDefault(AppointmentStatus.Requested),
            Confirmed = byStatus.GetValueOrDefault(AppointmentStatus.Confirmed),
            CheckedIn = byStatus.GetValueOrDefault(AppointmentStatus.CheckedIn),
            InProgress = byStatus.GetValueOrDefault(AppointmentStatus.InProgress),
            Completed = byStatus.GetValueOrDefault(AppointmentStatus.Completed),
            Cancelled = byStatus.GetValueOrDefault(AppointmentStatus.Cancelled),
            NoShow = byStatus.GetValueOrDefault(AppointmentStatus.NoShow),
            Temporary = temporary,
            Overdue = overdue,
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public Task<List<AppointmentDoctorTeamDto>> GetDoctorTeamsAsync() => _doctorTeams.GetTeamsAsync();

    private async Task<IQueryable<Appointment>> FilteredQueryAsync(
        GetAppointmentListInput input, bool skipTextSearch = false)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(a => a.BranchId == branchId);
        if (input.PatientId.HasValue) query = query.Where(a => a.PatientId == input.PatientId.Value);
        if (input.DentistId.HasValue) query = query.Where(a => a.DentistId == input.DentistId.Value);
        if (input.DentistIds is { Count: > 0 })
        {
            var dentistIds = input.DentistIds;
            query = query.Where(a => dentistIds.Contains(a.DentistId));
        }

        if (input.DoctorTeamId.HasValue)
        {
            var teamMemberIds = await _doctorTeams.GetMemberIdsAsync(input.DoctorTeamId.Value);
            query = query.Where(a => teamMemberIds.Contains(a.DentistId));
        }

        if (input.Status.HasValue) query = query.Where(a => a.Status == input.Status.Value);
        if (input.Statuses is { Count: > 0 })
        {
            var statuses = input.Statuses;
            query = query.Where(a => statuses.Contains(a.Status));
        }

        if (input.IsTemporary.HasValue) query = query.Where(a => a.IsTemporary == input.IsTemporary.Value);

        if (input.IsLate.HasValue)
        {
            // Npgsql requires UTC offset for timestamptz parameters.
            var now = DateTimeOffset.UtcNow;
            query = input.IsLate.Value
                ? query.Where(a => a.Status == AppointmentStatus.NoShow
                    || ((a.Status == AppointmentStatus.Requested || a.Status == AppointmentStatus.Confirmed)
                        && a.Slot.Start <= now))
                : query.Where(a => a.Status != AppointmentStatus.NoShow
                    && !((a.Status == AppointmentStatus.Requested || a.Status == AppointmentStatus.Confirmed)
                        && a.Slot.Start <= now));
        }

        if (input.Date.HasValue)
        {
            var from = ToInstant(input.Date.Value);
            var to = from.AddDays(1);
            query = query.Where(a => a.Slot.Start >= from && a.Slot.Start < to);
        }
        else
        {
            if (input.FromDate.HasValue)
            {
                var from = ToInstant(input.FromDate.Value);
                query = query.Where(a => a.Slot.Start >= from);
            }

            if (input.ToDate.HasValue)
            {
                var to = ToInstant(input.ToDate.Value).AddDays(1);
                query = query.Where(a => a.Slot.Start < to);
            }
        }

        if (!skipTextSearch && !string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim().ToLower();

            var patientQuery = await _patientRepository.GetQueryableAsync();
            var matchedPatients = await AsyncExecuter.ToListAsync(
                patientQuery
                    .Where(p => p.FirstName.ToLower().Contains(filter)
                                || p.LastName.ToLower().Contains(filter))
                    .Select(p => p.Id));

            var matchedStaff = (await _userRepository.GetListAsync())
                .Where(u =>
                    (u.Name != null && u.Name.Contains(filter, StringComparison.OrdinalIgnoreCase))
                    || u.UserName.Contains(filter, StringComparison.OrdinalIgnoreCase))
                .Select(u => u.Id)
                .ToList();

            query = query.Where(a =>
                (a.ChiefComplaint != null && a.ChiefComplaint.ToLower().Contains(filter))
                || (a.Notes != null && a.Notes.ToLower().Contains(filter))
                || matchedPatients.Contains(a.PatientId)
                || matchedStaff.Contains(a.DentistId)
                || (a.IsTemporary && a.PatientName != null && a.PatientName.ToLower().Contains(filter)));
        }

        return query;
    }

    /// <summary>
    /// An appointment stores ids, but every screen shows names: the calendar
    /// labels each card with the patient, the reception board groups by dentist.
    /// Resolved in one read per kind rather than one per row.
    /// </summary>
    private async Task FillNamesAsync(
        IReadOnlyList<Appointment> entities,
        IReadOnlyList<AppointmentDto> dtos)
    {
        if (entities.Count == 0)
        {
            return;
        }

        var patientIds = entities.Where(a => !a.IsTemporary).Select(a => a.PatientId).Distinct().ToList();
        var dentistIds = entities.Where(a => a.DentistId != Guid.Empty).Select(a => a.DentistId).Distinct().ToList();
        var procedureIds = entities
            .Where(a => a.ProcedureId.HasValue)
            .Select(a => a.ProcedureId!.Value)
            .Distinct()
            .ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = (await AsyncExecuter.ToListAsync(
                patientQuery.Where(p => patientIds.Contains(p.Id))))
            .ToDictionary(
                p => p.Id,
                p => (Name: (p.LastName + " " + p.FirstName).Trim(), Phone: p.Contact.PhoneNumber, Code: p.PatientCode, YearOfBirth: p.DateOfBirth.HasValue ? p.DateOfBirth.Value.Year : (int?)null));

        var users = await _userRepository.GetListByIdsAsync(dentistIds);
        var dentists = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var procedures = new Dictionary<Guid, string>();
        if (procedureIds.Count > 0)
        {
            var procedureQuery = await _procedureRepository.GetQueryableAsync();
            procedures = (await AsyncExecuter.ToListAsync(
                    procedureQuery.Where(x => procedureIds.Contains(x.Id))))
                .ToDictionary(x => x.Id, x => x.Name);
        }

        var followUpIds = entities
            .Where(a => a.FollowUpAppointmentId.HasValue)
            .Select(a => a.FollowUpAppointmentId!.Value)
            .Distinct()
            .ToList();
        var followUps = new Dictionary<Guid, DateTimeOffset>();
        if (followUpIds.Count > 0)
        {
            var appointmentQuery = await _repository.GetQueryableAsync();
            followUps = (await AsyncExecuter.ToListAsync(
                    appointmentQuery
                        .Where(x => followUpIds.Contains(x.Id) && x.Status != AppointmentStatus.Cancelled)
                        .Select(x => new { x.Id, x.Slot.Start })))
                .ToDictionary(x => x.Id, x => x.Start);
        }

        for (var i = 0; i < entities.Count; i++)
        {
            var entity = entities[i];
            var dto = dtos[i];

            if (entity.IsTemporary)
            {
                dto.PatientName = entity.PatientName ?? "";
                dto.PatientPhone = entity.PatientPhone;
            }
            else
            {
                var patient = patients.GetValueOrDefault(entity.PatientId);
                dto.PatientCode = patient.Code;
                dto.PatientName = patient.Name;
                dto.PatientPhone = patient.Phone;
                dto.PatientYearOfBirth = patient.YearOfBirth;
            }

            dto.DentistName = entity.DentistId != Guid.Empty
                ? dentists.GetValueOrDefault(entity.DentistId)
                : null;
            dto.ProcedureName = entity.ProcedureId.HasValue
                ? procedures.GetValueOrDefault(entity.ProcedureId.Value)
                : null;
            dto.FollowUpAt = entity.FollowUpAppointmentId is { } followUpId
                && followUps.TryGetValue(followUpId, out var followUpAt)
                    ? followUpAt
                    : null;
        }
    }

    /// <summary>Maps one appointment, names included.</summary>
    private async Task<AppointmentDto> ToDtoAsync(Appointment appointment)
    {
        var dto = ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
        await FillNamesAsync([appointment], [dto]);
        return dto;
    }

    /// <summary>
    /// The appointment as the history will remember it, names included, so a
    /// later rename of a doctor or patient does not rewrite the past.
    /// </summary>
    private async Task<AppointmentSnapshot> SnapshotAsync(Appointment appointment)
    {
        var dto = await ToDtoAsync(appointment);
        return AppointmentSnapshot.From(appointment, dto.DentistName, dto.PatientName, dto.PatientPhone);
    }

    private static readonly TimeSpan ClinicUtcOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// A calendar day in the clinic's local time (UTC+7), returned as a UTC instant.
    /// E.g. 2026-08-30 → 2026-08-29T17:00:00+00:00 (midnight UTC+7 expressed as UTC).
    /// </summary>
    private static DateTimeOffset ToInstant(DateOnly date) =>
        new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), ClinicUtcOffset)
            .ToUniversalTime();

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<AppointmentDto> GetAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentDto> CreateAsync(CreateAppointmentDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);

        // The refusals come first: the dentist overlap is only a warning the
        // user confirms, and confirming it must not then end in a refusal.
        if (await _conflictChecker.HasPatientConflictAsync(input.PatientId, slot))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked,
                "The patient already has an appointment in this time slot.");
        }

        await _shiftChecker.EnsureWithinShiftAsync(input.DentistId, branchId, slot);
        await _conflictChecker.EnsureDentistFreeAsync(input.DentistId, slot, input.AllowDentistOverlap);

        var appointment = new Appointment(
            GuidGenerator.Create(),
            input.PatientId,
            input.DentistId,
            branchId,
            slot,
            input.Type,
            input.ProcedureId,
            input.ChiefComplaint,
            input.Color,
            input.Notes);

        await _repository.InsertAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Created, appointment, null, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentDto> CreateTempAsync(CreateTempAppointmentDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);

        if (input.DentistId is { } dentistId)
        {
            await _shiftChecker.EnsureWithinShiftAsync(dentistId, branchId, slot);
            await _conflictChecker.EnsureDentistFreeAsync(dentistId, slot, input.AllowDentistOverlap);
        }

        var appointment = Appointment.CreateTemporary(
            GuidGenerator.Create(),
            input.PatientName,
            // Typed fresh: a masked value (Cụm 11 mục 9) has nothing to stand for.
            BlueDental.PatientManagement.PatientPhoneFormat.Prepare(
                BlueDental.PatientManagement.PatientPhoneMask.Resolve(input.PatientPhone)),
            branchId,
            slot,
            input.DentistId,
            input.SourceTaxonomyId,
            input.SourceEntryId,
            input.Color,
            input.Notes);

        await _repository.InsertAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Created, appointment, null, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> UpdateAsync(Guid id, UpdateAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.EnsureSeriesSessionEditable();
        var before = await SnapshotAsync(appointment);
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);
        var dentistId = input.DentistId ?? appointment.DentistId;

        if (appointment.PatientId != Guid.Empty
            && await _conflictChecker.HasPatientConflictAsync(appointment.PatientId, slot, excludeAppointmentId: id))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked,
                "The patient already has an appointment in this time slot.");
        }

        // Only a new time or dentist is checked: editing the notes of a booking
        // made before the shift rule existed must stay possible.
        var movedOrReassigned = slot.Start != appointment.Slot.Start
            || slot.End != appointment.Slot.End
            || dentistId != appointment.DentistId;
        if (movedOrReassigned && dentistId != Guid.Empty)
        {
            await _shiftChecker.EnsureWithinShiftAsync(dentistId, appointment.BranchId, slot);
        }

        // A booking confirmed into an overlap is not warned about again on every
        // edit — only when it moves, changes dentist or is put back on the book.
        var retakesSlot = input.Status is AppointmentStatus.Requested or AppointmentStatus.Confirmed
            && appointment.Status is AppointmentStatus.Cancelled or AppointmentStatus.NoShow;
        if (dentistId != Guid.Empty && (movedOrReassigned || retakesSlot))
        {
            await _conflictChecker.EnsureDentistFreeAsync(
                dentistId, slot, input.AllowDentistOverlap, excludeAppointmentId: id);
        }

        var statusBefore = appointment.Status;
        appointment.Reschedule(slot, input.DentistId);
        appointment.UpdateDetails(input.ChiefComplaint, input.Notes, input.Color);
        if (input.Status is { } status)
        {
            appointment.ChangeStatus(
                status, input.CancellationReason ?? CancellationReason.PatientRequest, input.CancellationNote);
        }

        if (appointment.IsTemporary)
        {
            if (!string.IsNullOrWhiteSpace(input.PatientName))
            {
                // The editor sends back the phone it showed, masked for an
                // account with "Ẩn số điện thoại" (Cụm 11 mục 9).
                appointment.UpdateTempPatientInfo(
                    input.PatientName,
                    BlueDental.PatientManagement.PatientPhoneFormat.Prepare(
                        BlueDental.PatientManagement.PatientPhoneMask.Resolve(input.PatientPhone, appointment.PatientPhone),
                        appointment.PatientPhone));
            }

            appointment.UpdateSourceInfo(input.SourceTaxonomyId, input.SourceEntryId);
        }

        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            ActionFor(statusBefore, appointment.Status), appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    /// <summary>
    /// An edit that also moved the status is logged as that move, the way the
    /// dedicated endpoints log it: "cancelled" for Đã huỷ, a status change for
    /// Trễ hẹn or for putting one back on the book, "updated" otherwise.
    /// </summary>
    private static AppointmentChangeAction ActionFor(AppointmentStatus before, AppointmentStatus after)
    {
        if (after == before) return AppointmentChangeAction.Updated;
        return after == AppointmentStatus.Cancelled
            ? AppointmentChangeAction.Cancelled
            : AppointmentChangeAction.StatusChanged;
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> ConfirmAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.Confirm();
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CancelAsync(Guid id, CancelAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.Cancel(input.Reason, input.Note);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Cancelled, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CheckInAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.EnsureCanArriveOn(ClinicToday());
        appointment.CheckIn();
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> StartAsync(Guid id, StartAppointmentDto? input = null)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.EnsureCanArriveOn(ClinicToday());
        appointment.Start();
        if (input?.Outcome is { } outcome)
            appointment.SetOutcome(outcome);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CompleteAsync(Guid id, CompleteAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.EnsureCanArriveOn(ClinicToday());
        appointment.Complete(input.Notes);
        if (input.Outcome is { } outcome)
            appointment.SetOutcome(outcome);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> MarkNoShowAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.MarkNoShow();
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> AssignDentistAsync(Guid id, AssignDentistDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        appointment.AssignDentist(input.DentistId);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Updated, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    /// <summary>
    /// Links a "Lịch tạm" to the patient record just created for it, so the
    /// card stops being temporary and opens that record from then on.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> AttachPatientAsync(Guid id, AttachPatientDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);

        var patient = await _patientRepository.FindAsync(input.PatientId);
        if (patient is null || patient.BranchId != appointment.BranchId)
            throw new EntityNotFoundException(typeof(Patient), input.PatientId);

        // Excluding itself: once attached, this appointment is the patient's own.
        if (await _conflictChecker.HasPatientConflictAsync(input.PatientId, appointment.Slot, appointment.Id))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked,
                "The patient already has an appointment in this time slot.");
        }

        var before = await SnapshotAsync(appointment);
        appointment.AttachPatient(input.PatientId);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Updated, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> SetOutcomeAsync(Guid id, SetOutcomeDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        // "Hẹn tái khám" frees the slot; moving off it takes the slot back even
        // when another patient has the dentist then — a dentist double-booking
        // is no longer refused (BA 2026-10-16) and this visit is under way.
        appointment.SetOutcome(input.Outcome);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Updated, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    /// <summary>
    /// "Đã hẹn tiếp" / "Hẹn tái khám" from the reception card: books the next appointment and
    /// marks this visit's outcome in one save, so neither exists without the other.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentDto> BookFollowUpAsync(Guid id, BookFollowUpDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        // Hẹn tái khám also receives a booking not yet received.
        if (input.Outcome is AppointmentOutcome.Revisit)
            appointment.EnsureCanArriveOn(ClinicToday());

        var currentFollowUp = appointment.FollowUpAppointmentId is { } currentId
            ? await _repository.FindAsync(currentId)
            : null;
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);
        var followUp = appointment.BookFollowUp(
            GuidGenerator.Create(), slot, currentFollowUp, input.DentistId, input.ChiefComplaint, input.Outcome);

        if (await _conflictChecker.HasPatientConflictAsync(followUp.PatientId, slot))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked,
                "The patient already has an appointment in this time slot.");
        }

        await _shiftChecker.EnsureWithinShiftAsync(followUp.DentistId, followUp.BranchId, slot);
        await _conflictChecker.EnsureDentistFreeAsync(followUp.DentistId, slot, input.AllowDentistOverlap);

        await _repository.InsertAsync(followUp, autoSave: true);
        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Created, followUp, null, await SnapshotAsync(followUp));
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Updated, appointment, before, await SnapshotAsync(appointment));
        return await ToDtoAsync(appointment);
    }

    /// <summary>
    /// "Hẹn lại - Chưa chốt ngày" (owner, 2026-10-09): saves "Đã hẹn tiếp" /
    /// "Hẹn tái khám" with no date and files the visit on the CSKH tab of the
    /// same name, in one save. Saving it again keeps the one care task and
    /// refreshes its doctor and note.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> RebookUndatedAsync(Guid id, RebookUndatedDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var before = await SnapshotAsync(appointment);
        if (input.Outcome is AppointmentOutcome.Revisit)
            appointment.EnsureCanArriveOn(ClinicToday());

        var currentFollowUp = appointment.FollowUpAppointmentId is { } currentId
            ? await _repository.FindAsync(currentId)
            : null;
        appointment.MarkRebookUndated(input.Outcome, currentFollowUp);

        await _repository.UpdateAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(
            AppointmentChangeAction.Updated, appointment, before, await SnapshotAsync(appointment));
        await FileUndatedRebookCareAsync(appointment, input);
        return await ToDtoAsync(appointment);
    }

    private async Task FileUndatedRebookCareAsync(Appointment appointment, RebookUndatedDto input)
    {
        var careRepository = LazyServiceProvider.LazyGetRequiredService<IRepository<CareRecord, Guid>>();
        var dentistId = input.DentistId ?? appointment.DentistId;
        var existing = await careRepository.FirstOrDefaultAsync(r =>
            r.Type == CareType.UndatedRebook && r.AppointmentId == appointment.Id);
        if (existing is null)
        {
            await careRepository.InsertAsync(
                CareRecord.UndatedRebook(
                    GuidGenerator.Create(),
                    appointment.PatientId,
                    appointment.BranchId,
                    dentistId,
                    appointment.Id,
                    Clock.Now,
                    input.Note),
                autoSave: true);
            return;
        }

        if (existing.Status is CareStatus.Cancelled) return;
        existing.RefreshUndatedRebook(dentistId, input.Note);
        await careRepository.UpdateAsync(existing, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.EnsureSeriesSessionEditable();
        var before = await SnapshotAsync(appointment);
        await _repository.DeleteAsync(appointment, autoSave: true);
        await _changeRecorder.RecordAsync(AppointmentChangeAction.Deleted, appointment, before, null);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Delete)]
    public async Task DeleteManyAsync(List<Guid> ids)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        var appointments = await AsyncExecuter.ToListAsync(
            query.Where(a => ids.Contains(a.Id) && a.BranchId == branchId));
        var snapshots = new List<(Appointment Appointment, AppointmentSnapshot Before)>();
        foreach (var appointment in appointments)
        {
            appointment.EnsureSeriesSessionEditable();
            snapshots.Add((appointment, await SnapshotAsync(appointment)));
        }

        await _repository.DeleteManyAsync(appointments, autoSave: true);
        foreach (var (appointment, before) in snapshots)
        {
            await _changeRecorder.RecordAsync(AppointmentChangeAction.Deleted, appointment, before, null);
        }
    }

    private static DateOnly ClinicToday() => ClinicCalendar.DateOf(DateTimeOffset.UtcNow);

    private void GuardBranchAccess(Appointment entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Appointment), entity.Id);
    }
}
