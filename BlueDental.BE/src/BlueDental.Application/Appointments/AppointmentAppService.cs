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
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(a => a.BranchId == branchId);
        if (input.PatientId.HasValue) query = query.Where(a => a.PatientId == input.PatientId.Value);
        if (input.DentistId.HasValue) query = query.Where(a => a.DentistId == input.DentistId.Value);
        if (input.Status.HasValue) query = query.Where(a => a.Status == input.Status.Value);

        // The calendar asks for one day or one week; without this the grids were
        // fed every appointment the clinic has ever had.
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

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();

            // The list search box offers "bệnh nhân, bác sĩ, lý do khám", but the
            // appointment row only holds ids. Matching names has to start from
            // the people, then narrow the appointments to them — filtering the
            // fetched page instead would only ever search the page on screen.
            var patientQuery = await _patientRepository.GetQueryableAsync();
            var matchedPatients = await AsyncExecuter.ToListAsync(
                patientQuery
                    .Where(p => p.FirstName.Contains(filter) || p.LastName.Contains(filter))
                    .Select(p => p.Id));

            var matchedStaff = (await _userRepository.GetListAsync())
                .Where(u =>
                    (u.Name != null && u.Name.Contains(filter, StringComparison.OrdinalIgnoreCase))
                    || u.UserName.Contains(filter, StringComparison.OrdinalIgnoreCase))
                .Select(u => u.Id)
                .ToList();

            query = query.Where(a =>
                (a.ChiefComplaint != null && a.ChiefComplaint.Contains(filter))
                || (a.Notes != null && a.Notes.Contains(filter))
                || matchedPatients.Contains(a.PatientId)
                || matchedStaff.Contains(a.DentistId));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);

        // Chronological, with Id breaking the tie so paging stays stable — two
        // appointments in the same slot used to be able to swap between pages.
        var items = await AsyncExecuter.ToListAsync(
            query
                .OrderBy(a => a.Slot.Start)
                .ThenBy(a => a.Id)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<Appointment>, List<AppointmentDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<AppointmentDto>(totalCount, dtos);
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

        var patientIds = entities.Select(a => a.PatientId).Distinct().ToList();
        var dentistIds = entities.Select(a => a.DentistId).Distinct().ToList();
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
                p => ((p.LastName + " " + p.FirstName).Trim(), p.Contact.PhoneNumber));

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

            var patient = patients.GetValueOrDefault(entity.PatientId);
            dto.PatientName = patient.Item1;
            dto.PatientPhone = patient.Item2;
            dto.DentistName = dentists.GetValueOrDefault(entity.DentistId);
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

    /// <summary>Slots are stored as UTC instants, so a calendar day starts at UTC midnight.</summary>
    private static DateTimeOffset ToInstant(DateOnly date) =>
        new(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

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
            input.ChiefComplaint);

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

    private void GuardBranchAccess(Appointment entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Appointment), entity.Id);
    }
}
