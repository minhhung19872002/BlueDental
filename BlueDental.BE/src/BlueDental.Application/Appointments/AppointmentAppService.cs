using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
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

    public AppointmentAppService(
        IRepository<Appointment, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<DentalProcedure, Guid> procedureRepository,
        IIdentityUserRepository userRepository,
        AppointmentConflictChecker conflictChecker,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _procedureRepository = procedureRepository;
        _userRepository = userRepository;
        _conflictChecker = conflictChecker;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<PagedResultDto<AppointmentDto>> GetListAsync(GetAppointmentListInput input)
    {
        var query = await FilteredQueryAsync(input);
        var totalCount = await AsyncExecuter.CountAsync(query);

        var hasDateFilter = input.Date.HasValue || input.FromDate.HasValue || input.ToDate.HasValue;

        var ordered = query
            .OrderBy(a => a.Slot.Start)
            .ThenBy(a => a.Id);

        var items = hasDateFilter
            ? await AsyncExecuter.ToListAsync(ordered)
            : await AsyncExecuter.ToListAsync(
                ordered.Skip(input.SkipCount).Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<Appointment>, List<AppointmentDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<AppointmentDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<AppointmentStatsDto> GetStatsAsync(GetAppointmentListInput input)
    {
        var query = await FilteredQueryAsync(input, skipTextSearch: true);
        var all = await AsyncExecuter.ToListAsync(query.Select(a => new { a.Status, a.IsTemporary }));

        return new AppointmentStatsDto
        {
            Requested = all.Count(a => a.Status == AppointmentStatus.Requested),
            Confirmed = all.Count(a => a.Status == AppointmentStatus.Confirmed),
            CheckedIn = all.Count(a => a.Status == AppointmentStatus.CheckedIn),
            InProgress = all.Count(a => a.Status == AppointmentStatus.InProgress),
            Completed = all.Count(a => a.Status == AppointmentStatus.Completed),
            Cancelled = all.Count(a => a.Status == AppointmentStatus.Cancelled),
            NoShow = all.Count(a => a.Status == AppointmentStatus.NoShow),
            Temporary = all.Count(a => a.IsTemporary),
        };
    }

    private async Task<IQueryable<Appointment>> FilteredQueryAsync(
        GetAppointmentListInput input, bool skipTextSearch = false)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(a => a.BranchId == branchId);
        if (input.PatientId.HasValue) query = query.Where(a => a.PatientId == input.PatientId.Value);
        if (input.DentistId.HasValue) query = query.Where(a => a.DentistId == input.DentistId.Value);
        if (input.Status.HasValue) query = query.Where(a => a.Status == input.Status.Value);
        if (input.Statuses is { Count: > 0 })
        {
            var statuses = input.Statuses;
            query = query.Where(a => statuses.Contains(a.Status));
        }

        if (input.IsTemporary.HasValue) query = query.Where(a => a.IsTemporary == input.IsTemporary.Value);

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
        }
    }

    /// <summary>Maps one appointment, names included.</summary>
    private async Task<AppointmentDto> ToDtoAsync(Appointment appointment)
    {
        var dto = ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
        await FillNamesAsync([appointment], [dto]);
        return dto;
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

        if (await _conflictChecker.HasDentistConflictAsync(input.DentistId, slot))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.ConflictingSlot,
                "The dentist already has an appointment in this time slot.");
        }

        if (await _conflictChecker.HasPatientConflictAsync(input.PatientId, slot))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.PatientAlreadyBooked,
                "The patient already has an appointment in this time slot.");
        }

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
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentDto> CreateTempAsync(CreateTempAppointmentDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);

        if (input.DentistId.HasValue
            && await _conflictChecker.HasDentistConflictAsync(input.DentistId.Value, slot))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Appointments.ConflictingSlot,
                "The dentist already has an appointment in this time slot.");
        }

        var appointment = Appointment.CreateTemporary(
            GuidGenerator.Create(),
            input.PatientName,
            input.PatientPhone,
            branchId,
            slot,
            input.DentistId,
            input.SourceTaxonomyId,
            input.SourceEntryId,
            input.Color,
            input.Notes);

        await _repository.InsertAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> UpdateAsync(Guid id, UpdateAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);
        appointment.Reschedule(slot, input.DentistId);
        appointment.UpdateDetails(input.ChiefComplaint, input.Notes, input.Color);

        if (appointment.IsTemporary)
        {
            if (!string.IsNullOrWhiteSpace(input.PatientName))
            {
                appointment.UpdateTempPatientInfo(input.PatientName, input.PatientPhone);
            }

            appointment.UpdateSourceInfo(input.SourceTaxonomyId, input.SourceEntryId);
        }

        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> ConfirmAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.Confirm();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CancelAsync(Guid id, CancelAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.Cancel(input.Reason, input.Note);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CheckInAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.CheckIn();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> StartAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.Start();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CompleteAsync(Guid id, CompleteAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.Complete(input.Notes);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> MarkNoShowAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.MarkNoShow();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> AssignDentistAsync(Guid id, AssignDentistDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.AssignDentist(input.DentistId);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> SetOutcomeAsync(Guid id, SetOutcomeDto input)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        appointment.SetOutcome(input.Outcome);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return await ToDtoAsync(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        GuardBranchAccess(appointment);
        await _repository.DeleteAsync(appointment, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Delete)]
    public async Task DeleteManyAsync(List<Guid> ids)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        var appointments = await AsyncExecuter.ToListAsync(
            query.Where(a => ids.Contains(a.Id) && a.BranchId == branchId));
        await _repository.DeleteManyAsync(appointments, autoSave: true);
    }

    private void GuardBranchAccess(Appointment entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Appointment), entity.Id);
    }
}
