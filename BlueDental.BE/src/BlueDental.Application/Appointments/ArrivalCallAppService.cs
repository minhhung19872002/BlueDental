using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Authorization;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.Appointments;

[Authorize]
public class ArrivalCallAppService(
    IRepository<Appointment, Guid> repository,
    IRepository<Patient, Guid> patientRepository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    AppointmentChangeRecorder changeRecorder,
    ArrivalBroadcast broadcast) : BlueDentalAppService, IArrivalCallAppService
{
    /// <summary>
    /// An account ticked "Bác sĩ" on the staff form gets its own patients; an
    /// admin gets every doctor's, ticked or not (owner 2026-11-02). Anyone
    /// else gets none.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    public async Task<List<ArrivalCallDto>> GetWaitingAsync()
    {
        var userId = CurrentUser.GetId();
        if (!IsAdmin() && !await IsDentistAsync(userId)) return [];

        var query = await TodaysArrivalsAsync();
        if (!IsAdmin()) query = query.Where(a => a.DentistId == userId);
        return await ToDtosAsync(query);
    }

    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    [Authorize(BlueDentalAbilityPermissions.Reception.Update)]
    public async Task<List<ArrivalCallDto>> GetInvitedAsync()
    {
        await EnsureNotDentistAsync();
        var query = await TodaysArrivalsAsync();
        return await ToDtosAsync(query.Where(a => a.InvitedAt != null));
    }

    /// <summary>Only the visit's own doctor — or an admin — calls the patient up.</summary>
    [Authorize(BlueDentalAbilityPermissions.Reception.Update)]
    public async Task<ArrivalCallDto> InviteAsync(Guid id)
    {
        var appointment = await GetInBranchAsync(id);
        var userId = CurrentUser.GetId();
        if (!IsAdmin() && (!await IsDentistAsync(userId) || appointment.DentistId != userId))
        {
            throw new AbpAuthorizationException("Only the visit's doctor can call the patient up.");
        }

        appointment.Invite(userId);
        await repository.UpdateAsync(appointment, autoSave: true);
        broadcast.AfterCommit(appointment.BranchId);
        return (await MapAsync([appointment]))[0];
    }

    /// <summary>
    /// Seating is reception's step: a doctor (the "Bác sĩ" tick) only calls
    /// patients up, whatever Tiếp nhận permissions their role carries — two
    /// doctors must not see, nor seat, each other's called-up patients. An
    /// admin does both steps.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    [Authorize(BlueDentalAbilityPermissions.Reception.Update)]
    public async Task<ArrivalCallDto> AdmitAsync(Guid id)
    {
        await EnsureNotDentistAsync();
        var appointment = await GetInBranchAsync(id);
        var dto = (await MapAsync([appointment]))[0];
        var before = Snapshot(appointment, dto);

        appointment.Admit();
        await repository.UpdateAsync(appointment, autoSave: true);
        await changeRecorder.RecordAsync(
            AppointmentChangeAction.StatusChanged, appointment, before, Snapshot(appointment, dto));
        broadcast.AfterCommit(appointment.BranchId);

        dto.InvitedAt = appointment.InvitedAt;
        return dto;
    }

    private bool IsAdmin() => CurrentUser.IsInRole(BlueDentalAbilitySeedContributor.AdminRoleName);

    /// <summary>The "Bác sĩ" tick on the staff form — not a role's name.</summary>
    private async Task<bool> IsDentistAsync(Guid userId)
    {
        var user = await userRepository.FindAsync(userId, includeDetails: false);
        return user?.ExtraProperties.GetOrDefault("IsDentist") is true;
    }

    /// <summary>The called-up list and "Tiếp nhận" are reception's: not a doctor's, unless an admin.</summary>
    private async Task EnsureNotDentistAsync()
    {
        if (!IsAdmin() && await IsDentistAsync(CurrentUser.GetId()))
        {
            throw new AbpAuthorizationException("A doctor calls patients up; reception seats them.");
        }
    }

    private static AppointmentSnapshot Snapshot(Appointment appointment, ArrivalCallDto dto) =>
        AppointmentSnapshot.From(appointment, dto.DentistName, dto.PatientName, null);

    private async Task<Appointment> GetInBranchAsync(Guid id)
    {
        var appointment = await repository.GetAsync(id);
        if (appointment.BranchId != branchResolver.GetRequiredClinicBranchId())
            throw new EntityNotFoundException(typeof(Appointment), id);
        return appointment;
    }

    /// <summary>Arrived and waiting at the current branch, checked in today.</summary>
    private async Task<IQueryable<Appointment>> TodaysArrivalsAsync()
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var todayStart = ClinicCalendar.StartOfDay(ClinicCalendar.DateOf(DateTimeOffset.UtcNow));
        var query = await repository.GetQueryableAsync();
        return query.Where(a =>
            a.BranchId == branchId
            && a.Status == AppointmentStatus.CheckedIn
            && a.CheckedInAt >= todayStart);
    }

    private async Task<List<ArrivalCallDto>> ToDtosAsync(IQueryable<Appointment> query)
    {
        var appointments = await AsyncExecuter.ToListAsync(
            query.OrderBy(a => a.CheckedInAt).ThenBy(a => a.Id));
        return await MapAsync(appointments);
    }

    private async Task<List<ArrivalCallDto>> MapAsync(IReadOnlyList<Appointment> appointments)
    {
        var patientIds = appointments.Where(a => !a.IsTemporary).Select(a => a.PatientId).Distinct().ToList();
        var patientQuery = await patientRepository.GetQueryableAsync();
        var patients = (await AsyncExecuter.ToListAsync(patientQuery
                .Where(p => patientIds.Contains(p.Id))
                .Select(p => new { p.Id, p.LastName, p.FirstName, p.DateOfBirth })))
            .ToDictionary(p => p.Id);

        var dentistIds = appointments.Select(a => a.DentistId).Where(id => id != Guid.Empty).Distinct().ToList();
        var dentists = (await userRepository.GetListByIdsAsync(dentistIds))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return appointments.Select(a =>
        {
            var patient = a.IsTemporary ? null : patients.GetValueOrDefault(a.PatientId);
            return new ArrivalCallDto
            {
                Id = a.Id,
                PatientId = a.PatientId,
                PatientName = a.IsTemporary
                    ? a.PatientName ?? ""
                    : patient is null ? "" : (patient.LastName + " " + patient.FirstName).Trim(),
                PatientYearOfBirth = patient?.DateOfBirth?.Year,
                IsTemporary = a.IsTemporary,
                PatientPhone = a.IsTemporary ? a.PatientPhone : null,
                DentistId = a.DentistId,
                DentistName = dentists.GetValueOrDefault(a.DentistId),
                SlotStart = a.Slot.Start,
                Content = string.IsNullOrWhiteSpace(a.ChiefComplaint) ? a.Notes : a.ChiefComplaint,
                CheckedInAt = a.CheckedInAt,
                InvitedAt = a.InvitedAt,
            };
        }).ToList();
    }
}
