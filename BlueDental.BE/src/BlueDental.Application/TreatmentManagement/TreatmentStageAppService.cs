using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Công đoạn điều trị — the steps that make up one treatment service.
///
/// The reference gives continue and complete their own ability verbs, so they get
/// their own endpoints and their own authorization checks here.
/// </summary>
[Authorize]
public class TreatmentStageAppService : ApplicationService, ITreatmentStageAppService
{
    private readonly IRepository<TreatmentStage, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public TreatmentStageAppService(
        IRepository<TreatmentStage, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _planRepository = planRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<PagedResultDto<TreatmentStageDto>> GetListAsync(GetTreatmentStageListInput input)
    {
        var query = await FilteredQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            // Steps read in the order they are worked, oldest first.
            .OrderBy(x => x.TreatmentServiceId)
            .ThenBy(x => x.SequenceNumber)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var lookups = await BuildLookupsAsync(items);
        return new PagedResultDto<TreatmentStageDto>(
            totalCount,
            items.Select(x => MapToDto(x, lookups)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<TreatmentStageDto> GetAsync(Guid id)
    {
        var stage = await LoadAsync(id);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<TreatmentStageProgressDto> GetProgressAsync(Guid treatmentServiceId)
    {
        var stages = await StagesOfServiceAsync(treatmentServiceId);

        var completed = stages.Count(x => x.Status == TreatmentStageStatus.Completed);
        return new TreatmentStageProgressDto
        {
            TreatmentServiceId = treatmentServiceId,
            Total = stages.Count,
            Completed = completed,
            InProgress = stages.Count(x => x.Status == TreatmentStageStatus.InProgress),
            Pending = stages.Count(x => x.Status == TreatmentStageStatus.Pending),
            ProgressPercent = stages.Count == 0 ? 0 : completed * 100 / stages.Count
        };
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<LatestTreatmentStageDto?> GetLatestAsync(Guid patientId)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(null);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        var latest = query
            .Where(x => x.PatientId == patientId)
            .OrderByDescending(x => x.CreationTime)
            .FirstOrDefault();

        if (latest == null)
        {
            return null;
        }

        var lookups = await BuildLookupsAsync([latest]);
        return new LatestTreatmentStageDto
        {
            StageId = latest.Id,
            TreatmentId = latest.TreatmentId,
            TreatmentServiceId = latest.TreatmentServiceId,
            ServiceName = lookups.ServiceNames.TryGetValue(latest.ServiceId, out var name) ? name : null,
            StageNote = latest.Note,
            StageDate = latest.CreationTime
        };
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Create)]
    public async Task<TreatmentStageDto> CreateAsync(CreateTreatmentStageDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        var stage = TreatmentStage.Add(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            input.TreatmentId,
            input.TreatmentServiceId,
            input.ServiceId,
            await NextSequenceNumberAsync(input.TreatmentServiceId),
            input.Name,
            input.StaffId,
            input.Note,
            input.ScheduledDate,
            input.IsImageRequired ?? await ServiceRequiresImageAsync(input.ServiceId),
            PatientDiagnosisAppService.ToToothSelections(input.Teeth),
            input.SecondStaffId);

        await _repository.InsertAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> UpdateAsync(Guid id, UpdateTreatmentStageDto input)
    {
        var stage = await LoadAsync(id);

        stage.UpdateDetails(
            input.Name,
            input.Note,
            input.ScheduledDate,
            input.StaffId,
            input.SecondStaffId,
            PatientDiagnosisAppService.ToToothSelections(input.Teeth));

        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Continue)]
    public async Task<TreatmentStageDto> ContinueAsync(Guid id)
    {
        var stage = await LoadAsync(id);
        stage.Continue();
        await _repository.UpdateAsync(stage, autoSave: true);

        await MoveServiceLineAsync(stage);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Complete)]
    public async Task<TreatmentStageDto> CompleteAsync(Guid id)
    {
        var stage = await LoadAsync(id);
        stage.Complete();
        await _repository.UpdateAsync(stage, autoSave: true);

        await MoveServiceLineAsync(stage);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> AttachImageAsync(Guid id, AttachStageImageDto input)
    {
        var stage = await LoadAsync(id);
        stage.AttachImage(input.ImageUrl);
        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task DeleteAsync(Guid id)
    {
        await LoadAsync(id);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>
    /// Keeps the service line in step with its công đoạn: the line starts as soon as
    /// any stage is under way, and finishes only once every stage of that line has.
    ///
    /// ASSUMED — the reference shows a per-line "Trạng thái - Tiến độ" but never
    /// revealed what advances it.
    /// </summary>
    private async Task MoveServiceLineAsync(TreatmentStage stage)
    {
        if (!stage.TreatmentId.HasValue)
        {
            return;
        }

        var query = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = query.FirstOrDefault(x => x.Id == stage.TreatmentId.Value);

        var line = plan?.Services.FirstOrDefault(s => s.Id == stage.TreatmentServiceId);
        if (plan == null || line == null || line.Status == TreatmentServiceStatus.Cancelled)
        {
            return;
        }

        var stageQuery = await _repository.GetQueryableAsync();
        var siblings = stageQuery.Where(x => x.TreatmentServiceId == line.Id).ToList();

        if (line.Status == TreatmentServiceStatus.Done)
        {
            return;
        }

        if (siblings.Count > 0 && siblings.TrueForAll(x => x.Status == TreatmentStageStatus.Completed))
        {
            line.Complete();
            plan.CloseIfAllServicesDone();
        }
        else
        {
            line.Start();
        }

        await _planRepository.UpdateAsync(plan, autoSave: true);
    }

    private async Task<TreatmentStage> LoadAsync(Guid id)
    {
        var stage = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(stage.ClinicBranchId);
        return stage;
    }

    private async Task<IQueryable<TreatmentStage>> FilteredQueryAsync(GetTreatmentStageListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.TreatmentId.HasValue)
            query = query.Where(x => x.TreatmentId == input.TreatmentId.Value);
        if (input.TreatmentServiceId.HasValue)
            query = query.Where(x => x.TreatmentServiceId == input.TreatmentServiceId.Value);
        if (input.StaffId.HasValue)
            query = query.Where(x => x.StaffId == input.StaffId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        return query;
    }

    private async Task<List<TreatmentStage>> StagesOfServiceAsync(Guid treatmentServiceId)
    {
        var query = await FilteredQueryAsync(
            new GetTreatmentStageListInput { TreatmentServiceId = treatmentServiceId });

        return query.ToList();
    }

    /// <summary>Stages are numbered 1..n inside their own service line.</summary>
    private async Task<int> NextSequenceNumberAsync(Guid treatmentServiceId)
    {
        var query = await _repository.GetQueryableAsync();
        var used = query.Where(x => x.TreatmentServiceId == treatmentServiceId).ToList();
        return used.Count == 0 ? 1 : used.Max(x => x.SequenceNumber) + 1;
    }

    /// <summary>The image requirement lives on the service catalog entry.</summary>
    private async Task<bool> ServiceRequiresImageAsync(Guid serviceId)
    {
        var query = await _catalogRepository.GetQueryableAsync();
        return query.Where(x => x.Id == serviceId).Select(x => x.IsImageRequired).FirstOrDefault();
    }

    private async Task<StageLookups> BuildLookupsAsync(IReadOnlyCollection<TreatmentStage> items)
    {
        var serviceIds = items.Select(x => x.ServiceId).Distinct().ToList();
        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();

        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var serviceNames = catalogQuery
            .Where(c => serviceIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);

        return new StageLookups(
            serviceNames,
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName));
    }

    private sealed record StageLookups(
        IReadOnlyDictionary<Guid, string> ServiceNames,
        IReadOnlyDictionary<Guid, string> StaffNames);

    private static TreatmentStageDto MapToDto(TreatmentStage entity, StageLookups lookups) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        TreatmentId = entity.TreatmentId,
        TreatmentServiceId = entity.TreatmentServiceId,
        ServiceId = entity.ServiceId,
        SequenceNumber = entity.SequenceNumber,
        Name = entity.Name,
        Note = entity.Note,
        StaffId = entity.StaffId,
        SecondStaffId = entity.SecondStaffId,
        ScheduledDate = entity.ScheduledDate,
        Status = entity.Status,
        IsImageRequired = entity.IsImageRequired,
        StartedAt = entity.StartedAt,
        CompletedAt = entity.CompletedAt,
        Teeth = PatientDiagnosisAppService.ToToothDtos(entity.Teeth),
        ImageUrls = entity.ImageUrls.ToList(),
        ServiceName = lookups.ServiceNames.TryGetValue(entity.ServiceId, out var service) ? service : null,
        StaffName = lookups.StaffNames.TryGetValue(entity.StaffId, out var staff) ? staff : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
