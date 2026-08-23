using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Operations;

/// <summary>
/// Công việc của từng khối.
/// </summary>
[Authorize]
public class OperationsTaskAppService : ApplicationService, IOperationsTaskAppService
{
    private readonly IRepository<OperationsTask, Guid> _repository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public OperationsTaskAppService(
        IRepository<OperationsTask, Guid> repository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    public async Task<PagedResultDto<OperationsTaskDto>> GetListAsync(GetOperationsTaskListInput input)
    {
        var items = await QueryAsync(input);

        var page = items
            // Open work first, then by due date — overdue items float to the top.
            .OrderBy(x => x.Status)
            .ThenBy(x => x.DueDate ?? DateOnly.MaxValue)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var assignees = await GetAssigneeNamesAsync(page);
        return new PagedResultDto<OperationsTaskDto>(
            items.Count,
            page.Select(x => MapToDto(x, assignees)).ToList());
    }

    public async Task<OperationsTaskStatsDto> GetStatsAsync(GetOperationsTaskListInput input)
    {
        var items = await QueryAsync(input);
        var today = Today();

        return new OperationsTaskStatsDto
        {
            Total = items.Count,
            Todo = items.Count(x => x.Status == OperationsTaskStatus.Todo),
            InProgress = items.Count(x => x.Status == OperationsTaskStatus.InProgress),
            Done = items.Count(x => x.Status == OperationsTaskStatus.Done),
            Overdue = items.Count(x => x.IsOverdueAsOf(today))
        };
    }

    public async Task<OperationsTaskDto> GetAsync(Guid id)
    {
        var task = await LoadAsync(id, BlueDentalAbilities.Actions.Read);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task<OperationsTaskDto> CreateAsync(CreateOperationsTaskDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await CheckAsync(input.Department, BlueDentalAbilities.Actions.Create);

        var task = OperationsTask.Create(
            GuidGenerator.Create(),
            input.ClinicBranchId,
            input.Department,
            input.Title,
            input.Description,
            input.AssigneeStaffId,
            input.DueDate);

        await _repository.InsertAsync(task, autoSave: true);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task<OperationsTaskDto> UpdateAsync(Guid id, UpdateOperationsTaskDto input)
    {
        var task = await LoadAsync(id, BlueDentalAbilities.Actions.Update);

        task.UpdateDetails(input.Title, input.Description, input.AssigneeStaffId, input.DueDate);

        await _repository.UpdateAsync(task, autoSave: true);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task<OperationsTaskDto> StartAsync(Guid id)
    {
        var task = await LoadAsync(id, BlueDentalAbilities.Actions.Update);
        task.Start();
        await _repository.UpdateAsync(task, autoSave: true);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task<OperationsTaskDto> CompleteAsync(Guid id)
    {
        var task = await LoadAsync(id, BlueDentalAbilities.Actions.Update);
        task.Complete();
        await _repository.UpdateAsync(task, autoSave: true);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task<OperationsTaskDto> CancelAsync(Guid id, CancelOperationsTaskDto input)
    {
        var task = await LoadAsync(id, BlueDentalAbilities.Actions.Update);
        task.Cancel(input.Reason);
        await _repository.UpdateAsync(task, autoSave: true);
        return MapToDto(task, await GetAssigneeNamesAsync([task]));
    }

    public async Task DeleteAsync(Guid id)
    {
        await LoadAsync(id, BlueDentalAbilities.Actions.Delete);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<OperationsTask> LoadAsync(Guid id, string action)
    {
        var task = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(task.ClinicBranchId);
        await CheckAsync(task.Department, action);
        return task;
    }

    private Task CheckAsync(OperationsDepartment department, string action) =>
        AuthorizationService.CheckAsync(OperationsAbilities.TaskPermissionFor(department, action));

    /// <summary>Overdue is derived, so that filter runs after the query.</summary>
    private async Task<List<OperationsTask>> QueryAsync(GetOperationsTaskListInput input)
    {
        if (input.Department.HasValue)
        {
            await CheckAsync(input.Department.Value, BlueDentalAbilities.Actions.Read);
        }

        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.Department.HasValue)
            query = query.Where(x => x.Department == input.Department.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);
        if (input.AssigneeStaffId.HasValue)
            query = query.Where(x => x.AssigneeStaffId == input.AssigneeStaffId.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Title.Contains(filter));
        }

        var items = query.ToList();

        if (input.OverdueOnly == true)
        {
            var today = Today();
            items = items.Where(x => x.IsOverdueAsOf(today)).ToList();
        }

        return items;
    }

    private DateOnly Today() => DateOnly.FromDateTime(Clock.Now);

    private async Task<Dictionary<Guid, string>> GetAssigneeNamesAsync(
        IReadOnlyCollection<OperationsTask> tasks)
    {
        var ids = tasks
            .Where(x => x.AssigneeStaffId.HasValue)
            .Select(x => x.AssigneeStaffId!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var users = await _userRepository.GetListByIdsAsync(ids);
        return users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private OperationsTaskDto MapToDto(
        OperationsTask entity,
        IReadOnlyDictionary<Guid, string> assignees) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        Department = entity.Department,
        Title = entity.Title,
        Description = entity.Description,
        AssigneeStaffId = entity.AssigneeStaffId,
        AssigneeName = entity.AssigneeStaffId.HasValue
            && assignees.TryGetValue(entity.AssigneeStaffId.Value, out var assignee)
                ? assignee
                : null,
        DueDate = entity.DueDate,
        Status = entity.Status,
        IsOverdue = entity.IsOverdueAsOf(Today()),
        CompletedAt = entity.CompletedAt,
        CancellationReason = entity.CancellationReason,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
