using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Queue;

/// <summary>
/// Màn hình đợi: every counter has its own dentist, its own number prefix and
/// its own queue. A number is taken at one counter and only that counter calls
/// it — urgent numbers first, then in the order they were taken. The queue day
/// is the clinic's (Vietnam) day.
/// </summary>
[Authorize]
public class QueueTicketAppService : BlueDentalAppService, IQueueTicketAppService
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

    private static DateOnly Today => ClinicCalendar.DateOf(DateTimeOffset.UtcNow);

    /// <summary>
    /// "Lấy số mới" at one counter: the counter hands out its next number
    /// (A001, A002, …), skipping any number still in its queue. Saving the
    /// counter bumps its concurrency stamp, so two receptionists pressing at
    /// the same moment cannot both get the same number.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Queue.Create)]
    public async Task<QueueTicketDto> CreateAsync(CreateQueueTicketDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var today = Today;

        if (input.CounterId is not { } counterId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.CounterRequired);
        }

        var counter = await GetCounterInBranchAsync(counterId);
        if (!counter.IsActive)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.CounterPausedTakeNumber);
        }

        // A walk-in takes a number with no record; the duplicate guard only
        // applies when the ticket is tied to a patient.
        if (input.PatientId is { } patientId)
        {
            var alreadyQueued = await AsyncExecuter.AnyAsync(
                (await _repository.GetQueryableAsync())
                    .Where(q => q.ClinicBranchId == branchId
                        && q.QueueDate == today
                        && q.PatientId == patientId
                        && (q.Status == QueueTicketStatus.Waiting
                            || q.Status == QueueTicketStatus.Called
                            || q.Status == QueueTicketStatus.Serving)));
            if (alreadyQueued)
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Queue.AlreadyQueued);
            }
        }

        var inQueue = await GetNumbersInQueueAsync(counter.Id, today);
        var number = counter.IssueNumber(today, inQueue.Contains);
        await _counterRepository.UpdateAsync(counter, autoSave: true);

        var ticket = new QueueTicket(
            GuidGenerator.Create(),
            branchId,
            today,
            number,
            counter.FormatNumber(number),
            input.PatientId,
            input.AppointmentId,
            input.Priority,
            input.ServiceType,
            counter.DentistId ?? input.DentistId,
            input.Note,
            counter.Id);

        await _repository.InsertAsync(ticket, autoSave: true);
        var dto = await ToDtoAsync(ticket);
        await _notifier.NotifyQueueUpdatedAsync(branchId);
        return dto;
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public async Task<PagedResultDto<QueueTicketDto>> GetListAsync(GetQueueTicketListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var date = input.Date ?? Today;

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId && q.QueueDate == date);

        if (input.Status.HasValue)
            query = query.Where(q => q.Status == input.Status.Value);

        if (input.CounterId.HasValue)
            query = query.Where(q => q.CounterId == input.CounterId.Value);

        var totalCount = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(
            query.OrderBy(q => q.Priority == QueueTicketPriority.Urgent ? 0 : 1)
                .ThenBy(q => q.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        var dtos = ObjectMapper.Map<List<QueueTicket>, List<QueueTicketDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<QueueTicketDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public async Task<QueueTicketDto> GetAsync(Guid id)
    {
        var ticket = await _repository.GetAsync(id);
        GuardBranchAccess(ticket);
        return await ToDtoAsync(ticket);
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
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

    /// <summary>
    /// "Gọi số tiếp theo" on one counter: the head of that counter's own queue
    /// (urgent first, then the order numbers were taken). Whatever the counter
    /// was still seeing is completed first, so a counter sees one number at a
    /// time. Skipped numbers stay out.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task<QueueTicketDto> CallNextAsync(CallTicketInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var today = Today;

        if (input.CounterId is not { } counterId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.CounterRequired);
        }

        var counter = await GetCounterInBranchAsync(counterId);
        if (!counter.IsActive)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.CounterPaused);
        }

        var next = await AsyncExecuter.FirstOrDefaultAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.ClinicBranchId == branchId
                    && q.QueueDate == today
                    && q.CounterId == counterId
                    && q.Status == QueueTicketStatus.Waiting)
                .OrderBy(q => q.Priority == QueueTicketPriority.Urgent ? 0 : 1)
                .ThenBy(q => q.CreationTime)
                .ThenBy(q => q.TicketNumber));

        if (next is null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.TicketNotFound,
                "No more tickets waiting.");
        }

        var stillAtCounter = await AsyncExecuter.ToListAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.ClinicBranchId == branchId
                    && q.QueueDate == today
                    && q.CounterId == counterId
                    && (q.Status == QueueTicketStatus.Called || q.Status == QueueTicketStatus.Serving)));
        foreach (var previous in stillAtCounter)
        {
            previous.Complete();
        }
        if (stillAtCounter.Count > 0)
        {
            await _repository.UpdateManyAsync(stillAtCounter, autoSave: true);
        }

        next.Call(counterId);
        await _repository.UpdateAsync(next, autoSave: true);
        var dto = await ToDtoAsync(next);
        await _notifier.NotifyTicketCalledAsync(next.Id, next.DisplayNumber, next.ClinicBranchId, next.CallCount);
        return dto;
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
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

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
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

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
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

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
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

    /// <summary>
    /// Day totals. A waiting number counts as a warning from 70% of its
    /// counter's threshold and as danger once past the threshold.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public async Task<QueueStatsDto> GetStatsAsync(DateOnly? date = null, Guid? counterId = null)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var targetDate = date ?? Today;

        var query = (await _repository.GetQueryableAsync())
            .Where(q => q.ClinicBranchId == branchId && q.QueueDate == targetDate);

        if (counterId.HasValue)
            query = query.Where(q => q.CounterId == counterId.Value);

        var tickets = await AsyncExecuter.ToListAsync(
            query.Select(q => new { q.Status, q.CreationTime, q.CounterId }));
        var thresholds = await GetThresholdsAsync(branchId);

        var now = DateTime.UtcNow;
        var waiting = tickets
            .Where(t => t.Status == QueueTicketStatus.Waiting)
            .Select(t => new
            {
                Minutes = (now - DateTime.SpecifyKind(t.CreationTime, DateTimeKind.Utc)).TotalMinutes,
                Threshold = t.CounterId is { } id && thresholds.TryGetValue(id, out var limit)
                    ? limit
                    : ServiceCounter.DefaultWaitWarningMinutes,
            })
            .ToList();

        return new QueueStatsDto
        {
            TotalToday = tickets.Count,
            Waiting = waiting.Count,
            Called = tickets.Count(t => t.Status == QueueTicketStatus.Called),
            Serving = tickets.Count(t => t.Status == QueueTicketStatus.Serving),
            Completed = tickets.Count(t => t.Status == QueueTicketStatus.Completed),
            Skipped = tickets.Count(t => t.Status == QueueTicketStatus.Skipped),
            WaitingWarning = waiting.Count(w => QueueWaitLevels.Of(w.Minutes, w.Threshold) == QueueWaitLevel.Warning),
            WaitingDanger = waiting.Count(w => QueueWaitLevels.Of(w.Minutes, w.Threshold) == QueueWaitLevel.Danger),
            AverageWaitMinutes = waiting.Count > 0 ? Math.Round(waiting.Average(w => w.Minutes), 1) : null,
        };
    }

    [AllowAnonymous]
    public async Task<List<QueueDisplayDto>> GetDisplayAsync(Guid branchId, Guid? counterId = null)
    {
        var today = Today;

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
                .ThenBy(q => q.CreationTime)
                .Take(50));

        var dtos = ObjectMapper.Map<List<QueueTicket>, List<QueueDisplayDto>>(tickets);
        await FillCounterNamesForDisplayAsync(tickets, dtos);
        return dtos;
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public Task<List<CounterBoardDto>> GetBoardAsync() =>
        BuildBoardAsync(_branchResolver.GetRequiredClinicBranchId());

    [AllowAnonymous]
    public Task<List<CounterBoardDto>> GetDisplayBoardAsync(Guid branchId) =>
        BuildBoardAsync(branchId);

    /// <summary>One card per counter, paused ones included, each with its own queue.</summary>
    private async Task<List<CounterBoardDto>> BuildBoardAsync(Guid branchId)
    {
        var counters = await AsyncExecuter.ToListAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == branchId)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name));

        var builder = await CreateBoardBuilderAsync(branchId, counters);
        return counters.Select(builder.Build).ToList();
    }

    /// <summary>"Hàng chờ · Quầy số 2": the counter's waiting list with estimated call times.</summary>
    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public async Task<CounterQueueDto> GetCounterQueueAsync(Guid counterId)
    {
        var counter = await GetCounterInBranchAsync(counterId);
        var builder = await CreateBoardBuilderAsync(counter.ClinicBranchId, [counter]);
        var inQueue = builder.NumbersInQueue(counter.Id);
        var nextNumber = counter.FormatNumber(counter.PeekNextNumber(Today, inQueue.Contains));
        return builder.BuildQueue(counter, nextNumber);
    }

    // ── Service Counter management ──

    [Authorize(BlueDentalAbilityPermissions.Queue.Read)]
    public async Task<List<ServiceCounterDto>> GetCountersAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var counters = await AsyncExecuter.ToListAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == branchId)
                .OrderBy(c => c.SortOrder)
                .ThenBy(c => c.Name));

        return await ToCounterDtosAsync(counters);
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task<ServiceCounterDto> CreateCounterAsync(CreateServiceCounterDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var counter = new ServiceCounter(
            GuidGenerator.Create(), branchId, input.Name, input.SortOrder, ToSettings(input));

        await EnsurePrefixFreeAsync(counter);
        await EnsureDentistAvailableAsync(counter, input.DentistId);
        counter.AssignDentist(input.DentistId, hasPatientsInQueue: false);

        await _counterRepository.InsertAsync(counter, autoSave: true);
        await _notifier.NotifyQueueUpdatedAsync(branchId);
        return (await ToCounterDtosAsync([counter]))[0];
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task<ServiceCounterDto> UpdateCounterAsync(Guid id, UpdateServiceCounterDto input)
    {
        var counter = await GetCounterInBranchAsync(id);
        counter.Update(input.Name, input.SortOrder, ToSettings(input));
        await EnsurePrefixFreeAsync(counter);

        // A counter saved before the dentist became required still has none.
        if (input.DentistId is null || input.DentistId != counter.DentistId)
        {
            await EnsureDentistAvailableAsync(counter, input.DentistId);
            var inQueue = await GetNumbersInQueueAsync(counter.Id, Today);
            counter.AssignDentist(input.DentistId, hasPatientsInQueue: inQueue.Count > 0);
        }

        await _counterRepository.UpdateAsync(counter, autoSave: true);
        await _notifier.NotifyQueueUpdatedAsync(counter.ClinicBranchId);
        return (await ToCounterDtosAsync([counter]))[0];
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task<ServiceCounterDto> ToggleCounterAsync(Guid id)
    {
        var counter = await GetCounterInBranchAsync(id);
        if (counter.IsActive)
            counter.Deactivate();
        else
            counter.Activate();
        await _counterRepository.UpdateAsync(counter, autoSave: true);
        await _notifier.NotifyQueueUpdatedAsync(counter.ClinicBranchId);
        return (await ToCounterDtosAsync([counter]))[0];
    }

    /// <summary>
    /// "Đặt lại số thứ tự ngay": the next number starts again from the start
    /// number. Numbers already waiting keep theirs; new ones skip them.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task<ServiceCounterDto> ResetCounterSequenceAsync(Guid id)
    {
        var counter = await GetCounterInBranchAsync(id);
        counter.ResetSequence();
        await _counterRepository.UpdateAsync(counter, autoSave: true);
        return (await ToCounterDtosAsync([counter]))[0];
    }

    [Authorize(BlueDentalAbilityPermissions.Queue.Update)]
    public async Task DeleteCounterAsync(Guid id)
    {
        var counter = await GetCounterInBranchAsync(id);
        await _counterRepository.DeleteAsync(counter, autoSave: true);
        await _notifier.NotifyQueueUpdatedAsync(counter.ClinicBranchId);
    }

    // ── Private helpers ──

    private static CounterSettings ToSettings(CreateServiceCounterDto input) => new(
        input.NumberPrefix,
        input.StartNumber,
        input.AutoResetDaily,
        input.WaitWarningMinutes,
        input.MinutesPerPatient);

    private async Task<ServiceCounter> GetCounterInBranchAsync(Guid id)
    {
        var counter = await _counterRepository.GetAsync(id);
        GuardCounterBranchAccess(counter);
        return counter;
    }

    /// <summary>Two live counters of a branch may not share a prefix — the numbers would collide.</summary>
    private async Task EnsurePrefixFreeAsync(ServiceCounter counter)
    {
        var taken = await AsyncExecuter.AnyAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == counter.ClinicBranchId
                    && c.Id != counter.Id
                    && c.NumberPrefix == counter.NumberPrefix));
        if (taken)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.DuplicatePrefix)
                .WithData("prefix", counter.NumberPrefix);
        }
    }

    /// <summary>The dentist must carry the "Bác sĩ" tick and head no other counter of the branch.</summary>
    private async Task EnsureDentistAvailableAsync(ServiceCounter counter, Guid? dentistId)
    {
        if (dentistId is not { } id)
        {
            return;
        }

        var user = await _userRepository.FindAsync(id, includeDetails: false);
        if (user is null || user.ExtraProperties.GetOrDefault("IsDentist") is not true)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.NotADentist);
        }

        var otherCounter = await AsyncExecuter.FirstOrDefaultAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == counter.ClinicBranchId
                    && c.Id != counter.Id
                    && c.DentistId == id)
                .Select(c => c.Name));
        if (otherCounter is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.DentistTaken)
                .WithData("counter", otherCounter);
        }
    }

    private async Task<HashSet<int>> GetNumbersInQueueAsync(Guid counterId, DateOnly today) =>
        (await AsyncExecuter.ToListAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.CounterId == counterId
                    && q.QueueDate == today
                    && (q.Status == QueueTicketStatus.Waiting
                        || q.Status == QueueTicketStatus.Called
                        || q.Status == QueueTicketStatus.Serving))
                .Select(q => q.TicketNumber)))
        .ToHashSet();

    private async Task<CounterBoardBuilder> CreateBoardBuilderAsync(Guid branchId, IReadOnlyCollection<ServiceCounter> counters)
    {
        var today = Today;
        var counterIds = counters.Select(c => c.Id).ToList();
        var tickets = await AsyncExecuter.ToListAsync(
            (await _repository.GetQueryableAsync())
                .Where(q => q.ClinicBranchId == branchId
                    && q.QueueDate == today
                    && q.CounterId != null
                    && counterIds.Contains(q.CounterId.Value))
                .Select(q => new CounterTicketRow(
                    q.Id, q.CounterId, q.DisplayNumber, q.TicketNumber, q.Status, q.Priority,
                    q.ServiceType, q.CreationTime, q.CalledAt, q.CompletedAt)));

        var dentistNames = await GetUserNamesAsync(counters.Select(c => c.DentistId));
        return new CounterBoardBuilder(DateTimeOffset.UtcNow, tickets, dentistNames);
    }

    private async Task<List<ServiceCounterDto>> ToCounterDtosAsync(IReadOnlyList<ServiceCounter> counters)
    {
        var today = Today;
        var counterIds = counters.Select(c => c.Id).ToList();
        var inQueue = (await AsyncExecuter.ToListAsync(
                (await _repository.GetQueryableAsync())
                    .Where(q => q.QueueDate == today
                        && q.CounterId != null
                        && counterIds.Contains(q.CounterId.Value)
                        && (q.Status == QueueTicketStatus.Waiting
                            || q.Status == QueueTicketStatus.Called
                            || q.Status == QueueTicketStatus.Serving))
                    .Select(q => q.CounterId!.Value)))
            .GroupBy(id => id)
            .ToDictionary(g => g.Key, g => g.Count());
        var dentistNames = await GetUserNamesAsync(counters.Select(c => c.DentistId));

        var dtos = ObjectMapper.Map<IReadOnlyList<ServiceCounter>, List<ServiceCounterDto>>(counters);
        for (var i = 0; i < dtos.Count; i++)
        {
            var counter = counters[i];
            dtos[i].DentistName = counter.DentistId is { } dentistId ? dentistNames.GetValueOrDefault(dentistId) : null;
            dtos[i].InQueueCount = inQueue.GetValueOrDefault(counter.Id);
            dtos[i].LastIssuedNumber = IssuedInCurrentRun(counter, today)
                ? counter.FormatNumber(counter.LastIssuedNumber)
                : null;
        }
        return dtos;
    }

    /// <summary>Whether the counter's last number still belongs to the running sequence.</summary>
    private static bool IssuedInCurrentRun(ServiceCounter counter, DateOnly today) =>
        counter.LastIssuedDate is { } issuedOn && (!counter.AutoResetDaily || issuedOn >= today);

    private async Task<Dictionary<Guid, int>> GetThresholdsAsync(Guid branchId) =>
        (await AsyncExecuter.ToListAsync(
            (await _counterRepository.GetQueryableAsync())
                .Where(c => c.ClinicBranchId == branchId)
                .Select(c => new { c.Id, c.WaitWarningMinutes })))
        .ToDictionary(c => c.Id, c => c.WaitWarningMinutes);

    /// <summary>Staff names as the pickers show them: surname + name, else the user name.</summary>
    private async Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid?> userIds)
    {
        var ids = userIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        return (await _userRepository.GetListByIdsAsync(ids))
            .ToDictionary(u => u.Id, StaffName);
    }

    private static string StaffName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }

    private async Task<QueueTicketDto> ToDtoAsync(QueueTicket ticket)
    {
        var dto = ObjectMapper.Map<QueueTicket, QueueTicketDto>(ticket);
        await FillNamesAsync([ticket], [dto]);
        return dto;
    }

    private async Task FillNamesAsync(IReadOnlyList<QueueTicket> tickets, IReadOnlyList<QueueTicketDto> dtos)
    {
        var patientIds = tickets.Where(t => t.PatientId.HasValue).Select(t => t.PatientId!.Value).Distinct().ToList();
        var counterIds = tickets.Where(t => t.CounterId.HasValue).Select(t => t.CounterId!.Value).Distinct().ToList();

        var patients = patientIds.Count > 0
            ? await AsyncExecuter.ToListAsync(
                (await _patientRepository.GetQueryableAsync())
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new { p.Id, p.FullName }))
            : [];

        var counters = counterIds.Count > 0
            ? await AsyncExecuter.ToListAsync(
                (await _counterRepository.GetQueryableAsync())
                    .Where(c => counterIds.Contains(c.Id))
                    .Select(c => new { c.Id, c.Name }))
            : [];

        var patientMap = patients.ToDictionary(p => p.Id, p => p.FullName);
        var dentistMap = await GetUserNamesAsync(tickets.Select(t => t.DentistId));
        var counterMap = counters.ToDictionary(c => c.Id, c => c.Name);

        for (var i = 0; i < dtos.Count; i++)
        {
            if (tickets[i].PatientId is { } patientId)
                dtos[i].PatientName = patientMap.GetValueOrDefault(patientId);
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
            throw new EntityNotFoundException(typeof(QueueTicket), ticket.Id);
        }
    }

    private void GuardCounterBranchAccess(ServiceCounter counter)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (counter.ClinicBranchId != branchId)
        {
            throw new EntityNotFoundException(typeof(ServiceCounter), counter.Id);
        }
    }
}
