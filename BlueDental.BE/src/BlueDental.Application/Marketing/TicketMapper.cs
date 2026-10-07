using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;
using Volo.Abp.Timing;

namespace BlueDental.Marketing;

/// <summary>Turns tickets and their timeline into DTOs, with the names the screen shows.</summary>
public class TicketMapper(
    IIdentityUserRepository userRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<Appointment, Guid> appointmentRepository,
    IAsyncQueryableExecuter asyncExecuter,
    IClock clock) : ITransientDependency
{
    public async Task<List<TicketDto>> MapAsync(IReadOnlyCollection<Ticket> tickets)
    {
        var names = await UserNamesAsync(tickets.SelectMany(t => new[] { t.AssigneeId, t.CreatorId, t.DeleterId }));

        var patientIds = tickets.Select(t => t.PatientId).OfType<Guid>().Distinct().ToList();
        var patientCodes = patientIds.Count == 0
            ? []
            : (await asyncExecuter.ToListAsync((await patientRepository.GetQueryableAsync())
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.PatientCode })))
                .ToDictionary(p => p.Id, p => p.PatientCode);

        var appointmentIds = tickets.Select(t => t.AppointmentId).OfType<Guid>().Distinct().ToList();
        var appointmentStarts = appointmentIds.Count == 0
            ? []
            : (await appointmentRepository.GetListAsync(a => appointmentIds.Contains(a.Id)))
                .ToDictionary(a => a.Id, a => a.Slot.Start);

        var now = clock.Now;
        return tickets.Select(t => new TicketDto
        {
            Id = t.Id,
            ClinicBranchId = t.ClinicBranchId,
            Code = t.Code,
            FullName = t.FullName,
            Phone = t.Phone,
            Email = t.Email,
            Note = t.Note,
            SourceTaxonomyId = t.SourceTaxonomyId,
            SourceEntryId = t.SourceEntryId,
            Channel = t.Channel,
            AssigneeId = t.AssigneeId,
            AssigneeName = Name(names, t.AssigneeId),
            AssignedAt = t.AssignedAt,
            ReceivedAt = t.ReceivedAt,
            PatientId = t.PatientId,
            PatientCode = t.PatientId is { } p ? patientCodes.GetValueOrDefault(p) : null,
            IsReturningCustomer = t.IsReturningCustomer,
            AppointmentId = t.AppointmentId,
            AppointmentStart = t.AppointmentId is { } a && appointmentStarts.TryGetValue(a, out var start) ? start : null,
            Status = t.Status,
            ProcessingDays = t.ProcessingDays,
            DueAt = t.DueAt,
            IsOverdue = t.IsOverdue(now),
            ContactCount = t.ContactCount,
            LastContactAt = t.LastContactAt,
            LastContactResult = t.LastContactResult,
            NextCallAt = t.NextCallAt,
            NotPotentialReason = t.NotPotentialReason,
            TagIds = [.. t.TagIds],
            CreatorId = t.CreatorId,
            CreatorName = Name(names, t.CreatorId),
            CreationTime = t.CreationTime,
            IsDeleted = t.IsDeleted,
            DeleteReason = t.DeleteReason,
            DeletionTime = t.DeletionTime,
            DeleterName = Name(names, t.DeleterId),
        }).ToList();
    }

    public async Task<List<TicketActivityDto>> MapAsync(IReadOnlyCollection<TicketActivity> activities)
    {
        var names = await UserNamesAsync(activities.SelectMany(a => new[] { a.AssigneeId, a.CreatorId }));
        return activities.Select(a => new TicketActivityDto
        {
            Id = a.Id,
            Kind = a.Kind,
            ContactResult = a.ContactResult,
            FromStatus = a.FromStatus,
            ToStatus = a.ToStatus,
            Note = a.Note,
            NextCallAt = a.NextCallAt,
            AssigneeId = a.AssigneeId,
            AssigneeName = Name(names, a.AssigneeId),
            AppointmentId = a.AppointmentId,
            CreatorId = a.CreatorId,
            CreatorName = Name(names, a.CreatorId),
            CreationTime = a.CreationTime,
        }).ToList();
    }

    private async Task<Dictionary<Guid, string>> UserNamesAsync(IEnumerable<Guid?> ids)
    {
        var userIds = ids.OfType<Guid>().Distinct().ToList();
        if (userIds.Count == 0)
        {
            return [];
        }

        return (await userRepository.GetListByIdsAsync(userIds)).ToDictionary(u => u.Id, FullName);
    }

    private static string? Name(Dictionary<Guid, string> names, Guid? id) =>
        id is { } value ? names.GetValueOrDefault(value) : null;

    internal static string FullName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}
