using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.Marketing;

/// <summary>
/// Marketing → Ticket (/marketing/tickets). BlueDental-local; see
/// docs/clone/pages/marketing-ticket.md.
///
/// The workflow lives on <see cref="Ticket"/>; this service adds what crosses
/// aggregates: the branch, whose tickets the caller may see, one open ticket per
/// phone, the patient the phone already belongs to, and the booking itself.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.MarketingTicket.Read)]
public class MarketingTicketAppService(
    IRepository<Ticket, Guid> repository,
    IRepository<TicketActivity, Guid> activityRepository,
    TicketReferenceChecker references,
    TicketMapper mapper,
    IAppointmentAppService appointmentService,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IMarketingTicketAppService
{
    public async Task<PagedResultDto<TicketDto>> GetListAsync(GetTicketListInput input)
    {
        using (input.Deleted ? DataFilter.Disable<ISoftDelete>() : NullDisposable.Instance)
        {
            var query = TicketListQuery.WithStatuses(await FilteredAsync(input), input.Statuses);
            var totalCount = await AsyncExecuter.CountAsync(query);
            var page = await AsyncExecuter.ToListAsync(query
                .OrderByDescending(x => x.ReceivedAt)
                .ThenByDescending(x => x.Code)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));
            return new PagedResultDto<TicketDto>(totalCount, await mapper.MapAsync(page));
        }
    }

    public async Task<TicketStatsDto> GetStatsAsync(GetTicketListInput input)
    {
        using (input.Deleted ? DataFilter.Disable<ISoftDelete>() : NullDisposable.Instance)
        {
            var query = await FilteredAsync(input);
            var byStatus = (await AsyncExecuter.ToListAsync(query
                    .GroupBy(x => x.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count() })))
                .ToDictionary(x => x.Status, x => x.Count);
            int Of(TicketStatus status) => byStatus.GetValueOrDefault(status);

            return new TicketStatsDto
            {
                Total = byStatus.Values.Sum(),
                New = Of(TicketStatus.New),
                InCare = Of(TicketStatus.InCare),
                Booked = Of(TicketStatus.Booked),
                Arrived = Of(TicketStatus.Arrived),
                NotPotential = Of(TicketStatus.NotPotential),
                Overdue = await AsyncExecuter.CountAsync(TicketListQuery.WhereOverdue(query, Clock.Now)),
                CallBackDue = await AsyncExecuter.CountAsync(TicketListQuery.WhereCallBackDue(query, Clock.Now)),
            };
        }
    }

    public async Task<TicketDto> GetAsync(Guid id) => await MapAsync(await GetCheckedAsync(id));

    public async Task<List<TicketActivityDto>> GetActivitiesAsync(Guid id)
    {
        var ticket = await GetCheckedAsync(id, includeDeleted: await IsGrantedAsync(BlueDentalAbilityPermissions.MarketingTicket.Delete));
        var activities = await AsyncExecuter.ToListAsync((await activityRepository.GetQueryableAsync())
            .Where(a => a.TicketId == ticket.Id)
            .OrderByDescending(a => a.CreationTime));
        return await mapper.MapAsync(activities);
    }

    public async Task<ListResultDto<TicketAssigneeDto>> GetAssigneesAsync(Guid? clinicBranchId)
    {
        var branchId = clinicBranchId ?? branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        return new ListResultDto<TicketAssigneeDto>(await references.AssigneesAsync(branchId));
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Create)]
    public async Task<CreateTicketResultDto> CreateAsync(CreateTicketDto input)
    {
        var branchId = await branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty, branchResolver.GetRequiredClinicBranchId());
        var phone = TicketPhone.Normalize(input.Phone);

        // One open ticket per phone: a lead that comes in again is the same lead.
        var open = await references.FindOpenByPhoneAsync(branchId, phone, exceptId: null);
        if (open is not null)
        {
            await activityRepository.InsertAsync(open.Reoccur(GuidGenerator.Create(), input.Note), autoSave: true);
            return new CreateTicketResultDto { Ticket = await MapAsync(open), Reoccurred = true };
        }

        if (input.AssigneeId is { } assigneeId)
        {
            await AuthorizationService.CheckAsync(BlueDentalAbilityPermissions.MarketingTicket.Transfer);
            await references.CheckAssigneeAsync(branchId, assigneeId);
        }

        var (ticket, created) = Ticket.Create(
            GuidGenerator.Create(), GuidGenerator.Create(), branchId,
            await references.NextCodeAsync(branchId), Details(input), TicketChannel.Manual,
            input.AssigneeId, Clock.Now);
        ticket.SetTags(input.TagIds, await references.ProcessingDaysAsync(branchId, input.TagIds));
        if (await references.FindPatientIdAsync(branchId, ticket.Phone) is { } patientId)
        {
            ticket.LinkPatient(patientId, returningCustomer: true);
        }

        await repository.InsertAsync(ticket, autoSave: true);
        await activityRepository.InsertAsync(created, autoSave: true);
        return new CreateTicketResultDto { Ticket = await MapAsync(ticket) };
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> UpdateAsync(Guid id, UpdateTicketDto input)
    {
        var ticket = await GetCheckedAsync(id);
        var phone = TicketPhone.Normalize(input.Phone);
        if (ticket.IsOpen && await references.FindOpenByPhoneAsync(ticket.ClinicBranchId, phone, ticket.Id) is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.DuplicateOpenPhone);
        }

        ticket.Update(Details(input));
        ticket.SetTags(input.TagIds, await references.ProcessingDaysAsync(ticket.ClinicBranchId, input.TagIds));
        if (ticket.PatientId is null && await references.FindPatientIdAsync(ticket.ClinicBranchId, ticket.Phone) is { } patientId)
        {
            ticket.LinkPatient(patientId, returningCustomer: true);
        }

        return await SaveAsync(ticket, activity: null);
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> RecordContactAsync(Guid id, RecordTicketContactDto input)
    {
        var ticket = await GetCheckedAsync(id);
        var activity = ticket.RecordContact(
            GuidGenerator.Create(), CurrentUser.GetId(), input.Result, input.Note, input.NextCallAt, Clock.Now);
        return await SaveAsync(ticket, activity);
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> ClaimAsync(Guid id)
    {
        var ticket = await GetCheckedAsync(id);
        if (ticket.AssigneeId == CurrentUser.GetId())
        {
            return await MapAsync(ticket);
        }

        if (ticket.AssigneeId is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        }

        return await SaveAsync(ticket, ticket.Assign(GuidGenerator.Create(), CurrentUser.GetId(), Clock.Now));
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Transfer)]
    public async Task<TicketDto> AssignAsync(Guid id, AssignTicketDto input)
    {
        var ticket = await GetCheckedAsync(id);
        if (input.AssigneeId is { } assigneeId)
        {
            await references.CheckAssigneeAsync(ticket.ClinicBranchId, assigneeId);
        }

        return await SaveAsync(ticket, ticket.Assign(GuidGenerator.Create(), input.AssigneeId, Clock.Now));
    }

    /// <summary>
    /// Chuyển Ticket (BA 8.3): the tickets the list filter matches — status tab
    /// included — dealt in turn, oldest first, to the chosen staff; several staff
    /// is "a group", which gets an even split. One branch at a time, since an
    /// assignee belongs to a branch. A ticket already with the staff member it
    /// would go to is left alone.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Transfer)]
    public async Task<TicketTransferResultDto> TransferAsync(TransferTicketsDto input)
    {
        var branchId = input.ClinicBranchId ?? branchResolver.GetRequiredClinicBranchId();
        await branchAccess.CheckAsync(branchId);
        var assignees = input.AssigneeIds.Where(x => x != Guid.Empty).Distinct().ToList();
        if (assignees.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.AssigneeNotInBranch);
        }

        foreach (var assigneeId in assignees)
        {
            await references.CheckAssigneeAsync(branchId, assigneeId);
        }

        input.ClinicBranchId = branchId;
        input.Deleted = false;
        var tickets = await AsyncExecuter.ToListAsync(
            TicketListQuery.WithStatuses(await FilteredAsync(input), input.Statuses)
                .OrderBy(x => x.ReceivedAt)
                .ThenBy(x => x.Code));

        var moved = new List<Ticket>();
        var activities = new List<TicketActivity>();
        for (var i = 0; i < tickets.Count; i++)
        {
            var assigneeId = TicketDistribution.AssigneeAt(assignees, i);
            if (tickets[i].AssigneeId == assigneeId)
            {
                continue;
            }

            activities.Add(tickets[i].Assign(GuidGenerator.Create(), assigneeId, Clock.Now));
            moved.Add(tickets[i]);
        }

        if (moved.Count > 0)
        {
            await activityRepository.InsertManyAsync(activities);
            await repository.UpdateManyAsync(moved, autoSave: true);
        }

        return new TicketTransferResultDto { Matched = tickets.Count, Transferred = moved.Count };
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> MarkNotPotentialAsync(Guid id, TicketReasonDto input)
    {
        var ticket = await GetCheckedAsync(id);
        return await SaveAsync(ticket, ticket.MarkNotPotential(GuidGenerator.Create(), input.Reason));
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> ReopenAsync(Guid id)
    {
        var ticket = await GetCheckedAsync(id);
        if (await references.FindOpenByPhoneAsync(ticket.ClinicBranchId, ticket.Phone, ticket.Id) is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.DuplicateOpenPhone);
        }

        return await SaveAsync(ticket, ticket.Reopen(GuidGenerator.Create()));
    }

    /// <summary>
    /// Đặt lịch hẹn: a regular appointment when the phone already has a patient
    /// record (a dentist is then required), otherwise a lịch tạm carrying the
    /// lead's name, phone and source — reception turns it into a patient on arrival.
    /// The appointment rules (slot, shift, appointment.create) are the Lịch hẹn ones.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Update)]
    public async Task<TicketDto> BookAppointmentAsync(Guid id, BookTicketAppointmentDto input)
    {
        var ticket = await GetCheckedAsync(id);
        if (ticket.ClinicBranchId != branchResolver.GetRequiredClinicBranchId())
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.BookFromOtherBranch);
        }

        if (ticket.Status is not (TicketStatus.New or TicketStatus.InCare))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTransition);
        }

        var appointment = await CreateAppointmentAsync(ticket, input);
        if (ticket.AssigneeId is null)
        {
            await activityRepository.InsertAsync(ticket.Assign(GuidGenerator.Create(), CurrentUser.GetId(), Clock.Now));
        }

        return await SaveAsync(ticket, ticket.MarkBooked(GuidGenerator.Create(), appointment.Id));
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Delete)]
    public async Task DeleteAsync(Guid id, TicketReasonDto input)
    {
        var ticket = await GetCheckedAsync(id);
        await activityRepository.InsertAsync(ticket.MarkDeleted(GuidGenerator.Create(), input.Reason));
        // ABP's soft delete reloads the row before flagging it, which would drop
        // DeleteReason — so the reason is saved on its own first.
        await repository.UpdateAsync(ticket, autoSave: true);
        await repository.DeleteAsync(ticket, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.MarketingTicket.Delete)]
    public async Task<TicketDto> RestoreAsync(Guid id)
    {
        var ticket = await GetCheckedAsync(id, includeDeleted: true);
        if (!ticket.IsDeleted)
        {
            return await MapAsync(ticket);
        }

        if (ticket.IsOpen && await references.FindOpenByPhoneAsync(ticket.ClinicBranchId, ticket.Phone, ticket.Id) is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.DuplicateOpenPhone);
        }

        var activity = ticket.Restore(GuidGenerator.Create());
        using (DataFilter.Disable<ISoftDelete>())
        {
            return await SaveAsync(ticket, activity);
        }
    }

    /// <remarks>
    /// Slots go down as UTC: Npgsql refuses a DateTimeOffset with any other
    /// offset, and an API caller may well send clinic time (+07:00).
    /// </remarks>
    private async Task<AppointmentDto> CreateAppointmentAsync(Ticket ticket, BookTicketAppointmentDto input)
    {
        if (ticket.PatientId is { } patientId)
        {
            if (input.DentistId is not { } dentistId)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.DentistRequired);
            }

            return await appointmentService.CreateAsync(new CreateAppointmentDto
            {
                PatientId = patientId,
                DentistId = dentistId,
                BranchId = ticket.ClinicBranchId,
                SlotStart = input.SlotStart.ToUniversalTime(),
                SlotEnd = input.SlotEnd.ToUniversalTime(),
                Type = AppointmentType.Consultation,
                Notes = input.Notes,
            });
        }

        return await appointmentService.CreateTempAsync(new CreateTempAppointmentDto
        {
            PatientName = ticket.FullName,
            PatientPhone = ticket.Phone,
            DentistId = input.DentistId,
            BranchId = ticket.ClinicBranchId,
            SlotStart = input.SlotStart.ToUniversalTime(),
            SlotEnd = input.SlotEnd.ToUniversalTime(),
            SourceTaxonomyId = ticket.SourceTaxonomyId,
            SourceEntryId = ticket.SourceEntryId,
            Notes = input.Notes,
        });
    }

    private async Task<IQueryable<Ticket>> FilteredAsync(GetTicketListInput input)
    {
        if (input.Deleted)
        {
            await AuthorizationService.CheckAsync(BlueDentalAbilityPermissions.MarketingTicket.Delete);
        }

        var branchFilter = await branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        return TicketListQuery.ApplyFilters(
            await repository.GetQueryableAsync(), input, branchFilter, await OwnerScopeAsync(), Clock.Now);
    }

    /// <summary>Null when the caller may read every ticket; otherwise their own id.</summary>
    private async Task<Guid?> OwnerScopeAsync() =>
        await IsGrantedAsync(BlueDentalAbilityPermissions.MarketingTicket.ReadAll) ? null : CurrentUser.GetId();

    private async Task<Ticket> GetCheckedAsync(Guid id, bool includeDeleted = false)
    {
        Ticket ticket;
        using (includeDeleted ? DataFilter.Disable<ISoftDelete>() : NullDisposable.Instance)
        {
            ticket = await repository.GetAsync(id);
        }

        await branchAccess.CheckAsync(ticket.ClinicBranchId);
        // A business error, not AbpAuthorizationException: ABP answers that one
        // with an empty 403, and a colleague having just claimed the ticket
        // should read as such, not as a missing permission.
        if (await OwnerScopeAsync() is { } me && ticket.AssigneeId is { } owner && owner != me)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.NotYours);
        }

        return ticket;
    }

    private async Task<TicketDto> SaveAsync(Ticket ticket, TicketActivity? activity)
    {
        if (activity is not null)
        {
            await activityRepository.InsertAsync(activity);
        }

        await repository.UpdateAsync(ticket, autoSave: true);
        return await MapAsync(ticket);
    }

    private async Task<TicketDto> MapAsync(Ticket ticket) => (await mapper.MapAsync([ticket]))[0];

    private Task<bool> IsGrantedAsync(string permission) => AuthorizationService.IsGrantedAsync(permission);

    private static TicketDetails Details(TicketInputDto input) => new(
        input.FullName, input.Phone, input.Email, input.Note, input.SourceTaxonomyId, input.SourceEntryId);
}
