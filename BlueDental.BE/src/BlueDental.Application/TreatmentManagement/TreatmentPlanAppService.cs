using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

[Authorize]
public class TreatmentPlanAppService : ApplicationService, ITreatmentPlanAppService
{
    private readonly IRepository<TreatmentPlan, Guid> _repository;
    private readonly ICurrentUser _currentUser;

    public TreatmentPlanAppService(
        IRepository<TreatmentPlan, Guid> repository,
        ICurrentUser currentUser)
    {
        _repository = repository;
        _currentUser = currentUser;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<PagedResultDto<TreatmentPlanDto>> GetListAsync(GetTreatmentPlanListInput input)
    {
        var query = await _repository.GetQueryableAsync();
        if (input.PatientId.HasValue) query = query.Where(p => p.PatientId == input.PatientId.Value);
        if (input.Status.HasValue) query = query.Where(p => p.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<TreatmentPlanDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<TreatmentPlan>, System.Collections.Generic.List<TreatmentPlanDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<TreatmentPlanDto> GetAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Create)]
    public async Task<TreatmentPlanDto> CreateAsync(CreateTreatmentPlanDto input)
    {
        var plan = new TreatmentPlan(
            GuidGenerator.Create(),
            input.PatientId,
            input.DentistId,
            input.BranchId,
            input.Title,
            input.Description,
            input.EstimatedCompletionDate);

        await _repository.InsertAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> UpdateAsync(Guid id, UpdateTreatmentPlanDto input)
    {
        var plan = await _repository.GetAsync(id);
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> SubmitForApprovalAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        plan.SubmitForApproval();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> ApproveAsync(Guid id, ApproveTreatmentPlanDto input)
    {
        var plan = await _repository.GetAsync(id);
        plan.Approve(_currentUser.GetId(), input.Notes);
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> StartAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        plan.Start();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> CompleteAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        plan.Complete();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentPlanDto> CancelAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        plan.Cancel();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }
}
