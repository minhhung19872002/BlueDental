using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class TreatmentPlanAppService : ApplicationService, ITreatmentPlanAppService
{
    private readonly IRepository<TreatmentPlan, Guid> _repository;
    private readonly ICurrentUser _currentUser;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public TreatmentPlanAppService(
        IRepository<TreatmentPlan, Guid> repository,
        ICurrentUser currentUser,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _currentUser = currentUser;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View)]
    public async Task<PagedResultDto<TreatmentPlanDto>> GetListAsync(GetTreatmentPlanListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(p => p.BranchId == branchId);
        if (input.PatientId.HasValue) query = query.Where(p => p.PatientId == input.PatientId.Value);
        if (input.Status.HasValue) query = query.Where(p => p.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<TreatmentPlanDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<TreatmentPlan>, System.Collections.Generic.List<TreatmentPlanDto>>(items));
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View)]
    public async Task<TreatmentPlanDto> GetAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Create)]
    public async Task<TreatmentPlanDto> CreateAsync(CreateTreatmentPlanDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var plan = new TreatmentPlan(
            GuidGenerator.Create(),
            input.PatientId,
            input.DentistId,
            branchId,
            input.Title,
            input.Description,
            input.EstimatedCompletionDate);

        await _repository.InsertAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<TreatmentPlanDto> UpdateAsync(Guid id, UpdateTreatmentPlanDto input)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.Update(input.Title, input.Description, input.EstimatedCompletionDate);
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<TreatmentPlanDto> SubmitForApprovalAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.SubmitForApproval();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Approve)]
    public async Task<TreatmentPlanDto> ApproveAsync(Guid id, ApproveTreatmentPlanDto input)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.Approve(_currentUser.GetId(), input.Notes);
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<TreatmentPlanDto> StartAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.Start();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<TreatmentPlanDto> CompleteAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.Complete();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit)]
    public async Task<TreatmentPlanDto> CancelAsync(Guid id)
    {
        var plan = await _repository.GetAsync(id);
        GuardBranchAccess(plan);
        plan.Cancel();
        await _repository.UpdateAsync(plan, autoSave: true);
        return ObjectMapper.Map<TreatmentPlan, TreatmentPlanDto>(plan);
    }

    private void GuardBranchAccess(TreatmentPlan entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(TreatmentPlan), entity.Id);
    }
}
