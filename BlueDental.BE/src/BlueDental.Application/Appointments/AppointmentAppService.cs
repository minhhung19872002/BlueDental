using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

[Authorize]
public class AppointmentAppService : ApplicationService, IAppointmentAppService
{
    private readonly IRepository<Appointment, Guid> _repository;
    private readonly AppointmentConflictChecker _conflictChecker;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public AppointmentAppService(
        IRepository<Appointment, Guid> repository,
        AppointmentConflictChecker conflictChecker,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
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

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<AppointmentDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Appointment>, System.Collections.Generic.List<AppointmentDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<AppointmentDto> GetAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
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
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> UpdateAsync(Guid id, UpdateAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        var slot = new AppointmentSlot(input.SlotStart, input.SlotEnd);
        appointment.Reschedule(slot, input.DentistId);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> ConfirmAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.Confirm();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CancelAsync(Guid id, CancelAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.Cancel(input.Reason, input.Note);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CheckInAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.CheckIn();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> StartAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.Start();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> CompleteAsync(Guid id, CompleteAppointmentDto input)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.Complete(input.Notes);
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Update)]
    public async Task<AppointmentDto> MarkNoShowAsync(Guid id)
    {
        var appointment = await _repository.GetAsync(id);
        appointment.MarkNoShow();
        await _repository.UpdateAsync(appointment, autoSave: true);
        return ObjectMapper.Map<Appointment, AppointmentDto>(appointment);
    }
}
