using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Staff;
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
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    ICurrentClinicBranchResolver branchResolver,
    AppointmentChangeRecorder changeRecorder,
    ArrivalBroadcast broadcast) : BlueDentalAppService, IArrivalCallAppService
{
    /// <summary>More doctors than any branch has: a longer pick is cut, not refused.</summary>
    private const int MaxPickedDentists = 200;

    /// <summary>
    /// An account ticked "Bác sĩ" on the staff form, or an admin, gets the
    /// doctors it picked with the 👁 (R-1164, BA 2026-11-06: "chọn hiển thị
    /// ai thì họ chọn") — another doctor's patients too, and may call them up
    /// (R-1171). With nothing picked a doctor gets its
    /// own patients and an admin every doctor's (owner 2026-11-02). Anyone
    /// else gets none.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    public async Task<List<ArrivalCallDto>> GetWaitingAsync(GetWaitingArrivalsInput input)
    {
        var userId = CurrentUser.GetId();
        if (!IsAdmin() && !await IsDentistAsync(userId)) return [];

        var query = await TodaysArrivalsAsync();
        if (input.All) return await ToDtosAsync(query);

        var picked = input.DentistIds.Distinct().Take(MaxPickedDentists).ToList();
        if (picked.Count > 0) return await ToDtosAsync(query.Where(a => picked.Contains(a.DentistId)));

        if (!IsAdmin()) query = query.Where(a => a.DentistId == userId);
        return await ToDtosAsync(query);
    }

    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    public async Task<List<ArrivalDoctorDto>> GetDoctorsAsync()
    {
        if (!IsAdmin() && !await IsDentistAsync(CurrentUser.GetId())) return [];

        var branchId = branchResolver.GetRequiredClinicBranchId();
        var assignmentQuery = await assignmentRepository.GetQueryableAsync();
        var staffIds = await AsyncExecuter.ToListAsync(assignmentQuery
            .Where(a => a.ClinicBranchId == branchId)
            .Select(a => a.StaffId)
            .Distinct());
        var users = await userRepository.GetListByIdsAsync(staffIds);

        return StaffPriority.Order(users.Where(u => u.IsActive && u.ExtraProperties.GetOrDefault("IsDentist") is true))
            .Select(u => new ArrivalDoctorDto
            {
                Id = u.Id,
                Name = u.Name ?? u.UserName,
                LabelColor = StaffLabelColor.Read(u),
            })
            .ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    [Authorize(BlueDentalAbilityPermissions.Reception.Update)]
    public async Task<List<ArrivalCallDto>> GetInvitedAsync()
    {
        await EnsureNotDentistAsync();
        var query = await TodaysArrivalsAsync();
        return await ToDtosAsync(query.Where(a => a.InvitedAt != null));
    }

    /// <summary>
    /// Any doctor (the "Bác sĩ" tick) — or an admin — calls the patient up,
    /// another doctor's visit too (R-1171, BA 2026-11-09: "bỏ logic chỉ cá
    /// nhân mới được mời"). Reception does not.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Reception.Update)]
    public async Task<ArrivalCallDto> InviteAsync(Guid id)
    {
        var appointment = await GetInBranchAsync(id);
        var userId = CurrentUser.GetId();
        if (!IsAdmin() && !await IsDentistAsync(userId))
        {
            throw new AbpAuthorizationException("Only a doctor can call the patient up.");
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
        var dentistUsers = await userRepository.GetListByIdsAsync(dentistIds);
        var dentists = dentistUsers.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
        var dentistColors = dentistUsers.ToDictionary(u => u.Id, StaffLabelColor.Read);

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
                DentistLabelColor = dentistColors.GetValueOrDefault(a.DentistId),
                SlotStart = a.Slot.Start,
                Content = string.IsNullOrWhiteSpace(a.ChiefComplaint) ? a.Notes : a.ChiefComplaint,
                CheckedInAt = a.CheckedInAt,
                InvitedAt = a.InvitedAt,
                IsFlagged = a.IsFlagged,
            };
        }).ToList();
    }
}
