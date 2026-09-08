using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Tái khám — the follow-up visit raised from a finished công đoạn.
///
/// A row of its own on the treatment table, not another công đoạn: see
/// <see cref="PatientReExamination"/> for what the reference's timeline returns.
/// Gated by the same ability as completing a công đoạn, because the reference's
/// ability list for <c>treatmentStage</c> has none of its own for the follow-up.
/// </summary>
[Authorize]
public class PatientReExaminationAppService : ApplicationService, IPatientReExaminationAppService
{
    private readonly IRepository<PatientReExamination, Guid> _repository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public PatientReExaminationAppService(
        IRepository<PatientReExamination, Guid> repository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _stageRepository = stageRepository;
        _planRepository = planRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Read)]
    public async Task<PagedResultDto<PatientReExaminationDto>> GetListAsync(
        GetPatientReExaminationListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.PatientId.HasValue)
        {
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        }

        if (input.PatientStageId.HasValue)
        {
            query = query.Where(x => x.PatientStageId == input.PatientStageId.Value);
        }

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientReExaminationDto>(totalCount, await MapManyAsync(items));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Complete)]
    public async Task<PatientReExaminationDto> CreateAsync(CreatePatientReExaminationDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        var stage = await _stageRepository.GetAsync(input.PatientStageId);
        await _branchAccess.CheckAsync(stage.ClinicBranchId);

        if (stage.Status != TreatmentStageStatus.Completed)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition,
                "A follow-up visit is only offered on a finished công đoạn.");
        }

        var visit = PatientReExamination.Raise(
            GuidGenerator.Create(),
            stage.PatientId,
            stage.ClinicBranchId,
            await NextCodeAsync(stage.PatientId),
            stage.Id,
            stage.TreatmentServiceId,
            stage.ServiceId,
            input.StaffId,
            input.Note,
            PatientDiagnosisAppService.ToToothSelections(input.Teeth),
            input.SubStaffId,
            input.SecondStaffId);

        await _repository.InsertAsync(visit, autoSave: true);

        // The reference flags the source stage, which is how its own row knows a
        // follow-up has been raised from it.
        stage.MarkReExamined();
        await _stageRepository.UpdateAsync(stage, autoSave: true);

        return (await MapManyAsync([visit])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<PatientReExaminationDto> AttachImageAsync(Guid id, AttachStageImageDto input)
    {
        var visit = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(visit.ClinicBranchId);

        visit.AttachImage(input.ImageUrl);
        await _repository.UpdateAsync(visit, autoSave: true);

        return (await MapManyAsync([visit])).Single();
    }

    /// <summary>REX001, REX002, … running per patient, as a slip's DT code does.</summary>
    private async Task<string> NextCodeAsync(Guid patientId)
    {
        var query = await _repository.GetQueryableAsync();
        var used = query.Count(x => x.PatientId == patientId) + 1;
        return $"REX{used:D3}";
    }

    private async Task<List<PatientReExaminationDto>> MapManyAsync(
        IReadOnlyCollection<PatientReExamination> items)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var serviceIds = items.Select(x => x.ServiceId).Distinct().ToList();
        var serviceNames = (await _catalogRepository.GetListAsync(x => serviceIds.Contains(x.Id)))
            .ToDictionary(x => x.Id, x => x.Name);

        var staffIds = items
            .SelectMany(x => new[] { x.StaffId, x.SubStaffId ?? Guid.Empty, x.SecondStaffId ?? Guid.Empty })
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();
        var staffNames = new Dictionary<Guid, string>();
        foreach (var id in staffIds)
        {
            var user = await _userRepository.FindAsync(id);
            if (user != null)
            {
                staffNames[id] = $"{user.Surname} {user.Name}".Trim();
            }
        }

        // SL on the row comes from the service line the source stage belongs to.
        var lineIds = items.Select(x => x.TreatmentServiceId).Distinct().ToList();
        var planQuery = await _planRepository.WithDetailsAsync(p => p.Services);
        var quantities = planQuery
            .SelectMany(p => p.Services)
            .Where(s => lineIds.Contains(s.Id))
            .ToList()
            .ToDictionary(s => s.Id, s => s.Quantity);

        string? NameOf(Guid? id) =>
            id.HasValue && staffNames.TryGetValue(id.Value, out var name) ? name : null;

        return items
            .Select(x => new PatientReExaminationDto
            {
                Id = x.Id,
                PatientId = x.PatientId,
                ClinicBranchId = x.ClinicBranchId,
                Code = x.Code,
                PatientStageId = x.PatientStageId,
                TreatmentServiceId = x.TreatmentServiceId,
                ServiceId = x.ServiceId,
                StaffId = x.StaffId,
                SubStaffId = x.SubStaffId,
                SecondStaffId = x.SecondStaffId,
                Note = x.Note,
                Teeth = x.Teeth
                    .Select(t => new ToothSelectionDto
                    {
                        ToothCode = t.ToothCode,
                        Selected = t.Selected,
                        Top = t.Top,
                        Right = t.Right,
                        Bottom = t.Bottom,
                        Left = t.Left,
                        Center = t.Center,
                    })
                    .ToList(),
                ImageUrls = x.ImageUrls.ToList(),
                Quantity = quantities.TryGetValue(x.TreatmentServiceId, out var qty) ? qty : 0,
                ServiceName = serviceNames.TryGetValue(x.ServiceId, out var svc) ? svc : null,
                StaffName = NameOf(x.StaffId),
                SubStaffName = NameOf(x.SubStaffId),
                SecondStaffName = NameOf(x.SecondStaffId),
                CreationTime = x.CreationTime,
            })
            .ToList();
    }
}
