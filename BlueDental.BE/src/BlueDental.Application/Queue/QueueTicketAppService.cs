using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Queue;

[Authorize]
public class QueueTicketAppService : ApplicationService, IQueueTicketAppService
{
    private readonly IRepository<QueueTicket, Guid> _repository;
    private readonly IRepository<ServiceCounter, Guid> _counterRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly IQueueNotifier _notifier;

    public QueueTicketAppService(
        IRepository<QueueTicket, Guid> repository,
        IRepository<ServiceCounter, Guid> counterRepository,
        IRepository<Patient, Guid> patientRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        IQueueNotifier notifier)
    {
        _repository = repository;
        _counterRepository = counterRepository;
        _patientRepository = patientRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _notifier = notifier;
    }

    public async Task<QueueTicketDto> CreateAsync(CreateQueueTicketDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var existing = await AsyncExecuter.FirstOrDefaultAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.ClinicBranchId == branchId
                    && q.QueueDate == today
                    && q.PatientId == input.PatientId
                    && q.Status != QueueTicketStatus.Completed
                    && q.Status != QueueTicketStatus.Expired));

        if (existing is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.AlreadyQueued);
        }

        var nextNumber = await GetNextTicketNumberAsync(branchId, today);
        var displayNumber = $"A-{nextNumber:D3}";

        var ticket = new QueueTicket(
            GuidGenerator.Create(),
            branchId,
            today,
            nextNumber,
            displayNumber,
            input.PatientId,
            input.AppointmentId,
            input.Priority,
            input.ServiceType,
            input.DentistId,
            input.Note,
            input.CounterId);

        await _repository.InsertAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyQueueUpdatedAsync(branchId);
        return dto;
    }

    public async Task<PagedResultDto<QueueTicketDto>> GetListAsync(GetQueueTicketListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var date = input.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId && q.QueueDate == date);

        if (input.Status.HasValue)
            query = query.Where(q => q.Status == input.Status.Value);

        if (input.CounterId.HasValue)
            query = query.Where(q => q.CounterId == input.CounterId.Value);

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(
            query.OrderBy(q => q.Priority == QueueTicketPriority.Urgent ? 0 : 1)
                .ThenBy(q => q.TicketNumber)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<QueueTicket>, List<QueueTicketDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<QueueTicketDto>(totalCount, dtos);
    }

    public async Task<QueueTicketDto> GetAsync(Guid id)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        return await ToDtoAsync(ticket);
    }

    public async Task<QueueTicketDto> CallAsync(Guid id, CallTicketInput input)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        ticket.Call(input.CounterId);
        await _repository.UpdateAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyTicketCalledAsync(ticket.Id, ticket.DisplayNumber, ticket.ClinicBranchId, ticket.CallCount);
        return dto;
    }

    public async Task<QueueTicketDto> CallNextAsync(CallTicketInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId
                && q.QueueDate == today
                && q.Status == QueueTicketStatus.Waiting);

        if (input.CounterId.HasValue)
            query = query.Where(q => q.CounterId == input.CounterId.Value);

        var next = await AsyncExecuter.FirstOrDefaultAsync(
            query.OrderBy(q => q.Priority == QueueTicketPriority.Urgent ? 0 : 1)
                .ThenBy(q => q.TicketNumber));

        if (next is null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.TicketNotFound,
                "No more tickets waiting.");
        }

        next.Call(input.CounterId);
        await _repository.UpdateAsync(next, autoSave: true);
        var dto = await ToDtoAsync(next);
        await _notifier.NotifyTicketCalledAsync(next.Id, next.DisplayNumber, next.ClinicBranchId, next.CallCount);
        return dto;
    }

    public async Task<QueueTicketDto> ServeAsync(Guid id)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        ticket.Serve();
        await _repository.UpdateAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyQueueUpdatedAsync(ticket.ClinicBranchId);
        return dto;
    }

    public async Task<QueueTicketDto> CompleteAsync(Guid id)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        ticket.Complete();
        await _repository.UpdateAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyQueueUpdatedAsync(ticket.ClinicBranchId);
        return dto;
    }

    public async Task<QueueTicketDto> SkipAsync(Guid id)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        ticket.Skip();
        await _repository.UpdateAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyQueueUpdatedAsync(ticket.ClinicBranchId);
        return dto;
    }

    public async Task<QueueTicketDto> RecallAsync(Guid id, CallTicketInput input)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        ticket.Call(input.CounterId);
        await _repository.UpdateAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyTicketCalledAsync(ticket.Id, ticket.DisplayNumber, ticket.ClinicBranchId, ticket.CallCount);
        return dto;
    }

    public async Task<QueueStatsDto> GetStatsAsync(DateOnly? date = null, Guid? counterId = null)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId && q.QueueDate == targetDate);

        if (counterId.HasValue)
            query = query.Where(q => q.CounterId == counterId.Value);

        var tickets = await AsyncExecuter.ToListAsync(query.Select(q => q.Status));

        return new QueueStatsDto
        {
            TotalToday = tickets.Count,
            Waiting = tickets.Count(s => s == QueueTicketStatus.Waiting),
            Called = tickets.Count(s => s == QueueTicketStatus.Called),
            Serving = tickets.Count(s => s == QueueTicketStatus.Serving),
            Completed = tickets.Count(s => s == QueueTicketStatus.Completed),
            Skipped = tickets.Count(s => s == QueueTicketStatus.Skipped),
        };
    }

    [AllowAnonymous]
    public async Task<List<QueueDisplayDto>> GetDisplayAsync(Guid branchId, Guid? counterId = null)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId
                && q.QueueDate == today
                && q.Status != QueueTicketStatus.Expired
                && q.Status != QueueTicketStatus.Completed);

        if (counterId.HasValue)
            query = query.Where(q => q.CounterId == counterId.Value);

        var tickets = await AsyncExecuter.ToListAsync(
            query.OrderBy(q => q.Status == QueueTicketStatus.Called ? 0
                    : q.Status == QueueTicketStatus.Serving ? 1
                    : q.Status == QueueTicketStatus.Waiting ? 2
                    : 3)
                .ThenBy(q => q.Priority == QueueTicketPriority.Urgent ? 0 : 1)
                .ThenBy(q => q.TicketNumber)
                .Take(50));

        var dtos = ObjectMapper.Map<List<QueueTicket>, List<QueueDisplayDto>>(tickets);
        await FillCounterNamesForDisplayAsync(tickets, dtos);
        return dtos;
    }

    // ── Service Counter management ──

    public async Task<List<ServiceCounterDto>> GetCountersAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var counters = await AsyncExecuter.ToListAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == branchId && !c.IsDeleted)
                .OrderBy(c => c.SortOrder));

        return ObjectMapper.Map<List<ServiceCounter>, List<ServiceCounterDto>>(counters);
    }

    public async Task<ServiceCounterDto> CreateCounterAsync(CreateServiceCounterDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var counter = new ServiceCounter(
            GuidGenerator.Create(), branchId, input.Name, input.SortOrder);
        await _counterRepository.InsertAsync(counter, autoSave: true);
        return ObjectMapper.Map<ServiceCounter, ServiceCounterDto>(counter);
    }

    public async Task<ServiceCounterDto> UpdateCounterAsync(Guid id, UpdateServiceCounterDto input)
    {
        var counter = await _counterRepository.GetAsync(id);
        GuardCounterBranchAccess(counter);
        counter.Update(input.Name, input.SortOrder);
        await _counterRepository.UpdateAsync(counter, autoSave: true);
        return ObjectMapper.Map<ServiceCounter, ServiceCounterDto>(counter);
    }

    public async Task<ServiceCounterDto> ToggleCounterAsync(Guid id)
    {
        var counter = await _counterRepository.GetAsync(id);
        GuardCounterBranchAccess(counter);
        if (counter.IsActive)
            counter.Deactivate();
        else
            counter.Activate();
        await _counterRepository.UpdateAsync(counter, autoSave: true);
        return ObjectMapper.Map<ServiceCounter, ServiceCounterDto>(counter);
    }

    public async Task DeleteCounterAsync(Guid id)
    {
        var counter = await _counterRepository.GetAsync(id);
        GuardCounterBranchAccess(counter);
        await _counterRepository.DeleteAsync(counter, autoSave: true);
    }

    // ── Private helpers ──

    private async Task<int> GetNextTicketNumberAsync(Guid branchId, DateOnly date)
    {
        var maxNumber = await AsyncExecuter.MaxAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.ClinicBranchId == branchId && q.QueueDate == date)
                .Select(q => (int?)q.TicketNumber));

        return (maxNumber ?? 0) + 1;
    }

    private async Task<QueueTicketDto> ToDtoAsync(QueueTicket ticket)
    {
        var dto = ObjectMapper.Map<QueueTicket, QueueTicketDto>(ticket);
        await FillNamesAsync([ticket], [dto]);
        return dto;
    }

    private async Task FillNamesAsync(IReadOnlyList<QueueTicket> tickets, IReadOnlyList<QueueTicketDto> dtos)
    {
        var patientIds = tickets.Select(t => t.PatientId).Distinct().ToList();
        var dentistIds = tickets.Where(t => t.DentistId.HasValue).Select(t => t.DentistId!.Value).Distinct().ToList();
        var counterIds = tickets.Where(t => t.CounterId.HasValue).Select(t => t.CounterId!.Value).Distinct().ToList();

        var patients = patientIds.Count > 0
            ? await AsyncExecuter.ToListAsync(
                (await _patientRepository.GetQueryableAsync())
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.FullName }))
            : [];

        var dentists = dentistIds.Count > 0
            ? (await _userRepository.GetListAsync())
                .Where(u => dentistIds.Contains(u.Id))
                .Select(u => new { u.Id, Name = u.Name ?? u.UserName })
                .ToList()
            : [];

        var counters = counterIds.Count > 0
            ? await AsyncExecuter.ToListAsync(
                (await _counterRepository.GetQueryableAsync())
                    .Where(c => counterIds.Contains(c.Id))
                    .Select(c => new { c.Id, c.Name }))
            : [];

        var patientMap = patients.ToDictionary(p => p.Id, p => p.FullName);
        var dentistMap = dentists.ToDictionary(d => d.Id, d => d.Name);
        var counterMap = counters.ToDictionary(c => c.Id, c => c.Name);

        for (var i = 0; i < dtos.Count; i++)
        {
            dtos[i].PatientName = patientMap.GetValueOrDefault(tickets[i].PatientId);
            if (tickets[i].DentistId is { } dentistId)
                dtos[i].DentistName = dentistMap.GetValueOrDefault(dentistId);
            if (tickets[i].CounterId is { } counterId)
                dtos[i].CounterName = counterMap.GetValueOrDefault(counterId);
        }
    }

    private async Task FillCounterNamesForDisplayAsync(
        IReadOnlyList<QueueTicket> tickets, IReadOnlyList<QueueDisplayDto> dtos)
    {
        var counterIds = tickets.Where(t => t.CounterId.HasValue).Select(t => t.CounterId!.Value).Distinct().ToList();
        if (counterIds.Count == 0) return;

        var counters = await AsyncExecuter.ToListAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => counterIds.Contains(c.Id))
                .Select(c => new { c.Id, c.Name }));

        var counterMap = counters.ToDictionary(c => c.Id, c => c.Name);
        for (var i = 0; i < dtos.Count; i++)
        {
            if (tickets[i].CounterId is { } counterId)
                dtos[i].CounterName = counterMap.GetValueOrDefault(counterId);
        }
    }

    private void GuardBranchAccess(QueueTicket ticket)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (ticket.ClinicBranchId != branchId)
        {
            throw new Volo.Abp.Domain.Entities.EntityNotFoundException(typeof(QueueTicket), ticket.Id);
        }
    }

    private void GuardCounterBranchAccess(ServiceCounter counter)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (counter.ClinicBranchId != branchId)
        {
            throw new Volo.Abp.Domain.Entities.EntityNotFoundException(typeof(ServiceCounter), counter.Id);
        }
    }
}
