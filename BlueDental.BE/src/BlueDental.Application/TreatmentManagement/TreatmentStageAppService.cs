using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.CustomerCare;
using BlueDental.Labo;
using BlueDental.Organizations;
using BlueDental.Staff;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
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
    private readonly StageTeethPolicy _teethPolicy;
    private readonly AfterTreatmentCareRecorder _afterTreatmentCare;
    private readonly IRepository<LaboOrder, Guid> _laboRepository;
    private readonly LaboStagePolicy _laboPolicy;
    private readonly IRepository<ServiceWarrantyCard, Guid> _cardRepository;
    private readonly ServiceLineProgress _lineProgress;
    private readonly TreatmentStageChangeRecorder _changes;
    private readonly IRepository<TreatmentStageChangeLog, Guid> _changeLogRepository;
    private readonly StageLineGuard _lineGuard;

    public TreatmentStageAppService(
        IRepository<TreatmentStage, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        StageTeethPolicy teethPolicy,
        AfterTreatmentCareRecorder afterTreatmentCare,
        IRepository<LaboOrder, Guid> laboRepository,
        LaboStagePolicy laboPolicy,
        IRepository<ServiceWarrantyCard, Guid> cardRepository,
        ServiceLineProgress lineProgress,
        TreatmentStageChangeRecorder changes,
        IRepository<TreatmentStageChangeLog, Guid> changeLogRepository,
        StageLineGuard lineGuard)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _planRepository = planRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _teethPolicy = teethPolicy;
        _afterTreatmentCare = afterTreatmentCare;
        _laboRepository = laboRepository;
        _laboPolicy = laboPolicy;
        _cardRepository = cardRepository;
        _lineProgress = lineProgress;
        _changes = changes;
        _changeLogRepository = changeLogRepository;
        _lineGuard = lineGuard;
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
            .OrderByDescending(x => x.TreatmentDate)
            .ThenByDescending(x => x.CreationTime)
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
            StageDate = ClinicCalendar.StartOfDay(latest.TreatmentDate)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Create)]
    public async Task<TreatmentStageDto> CreateAsync(CreateTreatmentStageDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        await _lineGuard.EnsureOpenAsync(input.TreatmentServiceId);

        var teeth = PatientDiagnosisAppService.ToToothSelections(input.Teeth);
        var lineTeeth = await LineTeethAsync(input.TreatmentId, input.TreatmentServiceId);
        var lineStages = await StagesOfLineAsync(input.TreatmentServiceId);

        Guid? warrantyRootStageId = null;
        WarrantyCover? cover = null;
        if (input.IsGuarantee)
        {
            // A line finished by hand has no công đoạn to continue (REQ-B8); a
            // named source must still be one of the line's.
            TreatmentStage? source = null;
            if (input.WarrantySourceStageId.HasValue)
            {
                source = lineStages.FirstOrDefault(s => s.Id == input.WarrantySourceStageId)
                    ?? throw new BusinessException(
                        BlueDentalDomainErrorCodes.TreatmentManagement.WarrantySourceInvalid,
                        "A warranty continues from a finished công đoạn of its line.");

                // The root is the ordinary công đoạn the warranty chain started from;
                // a warranty raised off a warranty inherits the one before it.
                warrantyRootStageId = source.IsGuarantee ? source.WarrantyRootStageId : source.Id;
            }

            var root = lineStages.FirstOrDefault(s => s.Id == warrantyRootStageId);
            cover = await WarrantyCoverAsync(input);
            _teethPolicy.EnsureWarranty(source, root, lineTeeth, lineStages, teeth, cover);
        }
        else
        {
            _teethPolicy.EnsureNewStageTeeth(lineTeeth, lineStages, teeth);
        }

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
            teeth,
            input.SecondStaffId,
            input.SubStaffId,
            input.IsGuarantee,
            input.ServiceItemIds,
            warrantyRootStageId: warrantyRootStageId,
            treatmentDate: input.TreatmentDate);
        stage.SetRemark(input.Remark);
        if (cover is not null)
        {
            stage.WorkUnder(cover);
        }

        await _repository.InsertAsync(stage, autoSave: true);

        // The first công đoạn is what puts a line to work, so the line has to be
        // moved here too. Without this the line sat at "BE:Status:Created" however many
        // công đoạn it carried, and "BE:CareType:ServicesInTreatment" stayed empty while the
        // slip beside it already read "BE:CareType:InTreatment" (R-463).
        await MoveServiceLineAsync(stage);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> UpdateAsync(Guid id, UpdateTreatmentStageDto input)
    {
        var stage = await LoadWritableAsync(id);
        var before = TreatmentStageChangeRecorder.Snapshot(stage);

        stage.UpdateDetails(
            input.Name,
            input.Note,
            input.ScheduledDate,
            input.StaffId,
            input.SecondStaffId,
            input.SubStaffId,
            PatientDiagnosisAppService.ToToothSelections(input.Teeth));

        var after = TreatmentStageChangeRecorder.Snapshot(stage);
        if (before != after)
        {
            await _changes.RecordAsync(stage, TreatmentStageChangeAction.DetailsUpdated, before, after);
        }

        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// Nội dung điều trị, edited in its cell. Open on every row — finished,
    /// continued or back-dated — and logged (BA 2026-11-02 "Cho phép chỉnh sửa
    /// hết – Nhưng mọi chỉnh sửa có ghi log"). The full edit above keeps its own
    /// guards: it also moves teeth and doctors.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> UpdateNoteAsync(Guid id, UpdateTreatmentStageNoteDto input)
    {
        var stage = await LoadWritableAsync(id);
        var before = stage.Note;
        stage.SetNote(input.Note);
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.NoteChanged, before, stage.Note);
        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// The công đoạn's change log, oldest first. Gated like Xóa công đoạn, the
    /// admin's own ability (BA 2026-11-02: "để admin có thể coi").
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Delete)]
    public async Task<List<TreatmentStageChangeLogDto>> GetChangeLogsAsync(Guid id)
    {
        var logs = await _changeLogRepository.GetListAsync(x => x.TreatmentStageId == id);
        if (logs.Count == 0)
        {
            return [];
        }

        await _branchAccess.CheckAsync(logs[0].ClinicBranchId);
        return (await DescribeLogsAsync(logs)).OrderBy(x => x.OccurredAt).ToList();
    }

    /// <summary>
    /// "Lịch sử chỉnh sửa" of LỊCH SỬ ĐIỀU TRỊ: the log of every công đoạn on
    /// the slip, newest first — a deleted one's too, which no row is left to
    /// open it from.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Delete)]
    public async Task<List<TreatmentStageChangeLogDto>> GetTreatmentChangeLogsAsync(Guid treatmentId)
    {
        List<(Guid Id, Guid ClinicBranchId)> stages;
        using (DataFilter.Disable<ISoftDelete>())
        {
            var query = await _repository.GetQueryableAsync();
            stages = (await AsyncExecuter.ToListAsync(query
                    .Where(x => x.TreatmentId == treatmentId)
                    .Select(x => new { x.Id, x.ClinicBranchId })))
                .Select(x => (x.Id, x.ClinicBranchId))
                .ToList();
        }

        if (stages.Count == 0)
        {
            return [];
        }

        await _branchAccess.CheckAsync(stages[0].ClinicBranchId);
        var stageIds = stages.Select(x => x.Id).ToList();
        var logs = await _changeLogRepository.GetListAsync(x => stageIds.Contains(x.TreatmentStageId));
        return (await DescribeLogsAsync(logs)).OrderByDescending(x => x.OccurredAt).ToList();
    }

    /// <summary>Each log row with its công đoạn (deleted or not) and its fields by name.</summary>
    private async Task<List<TreatmentStageChangeLogDto>> DescribeLogsAsync(IReadOnlyCollection<TreatmentStageChangeLog> logs)
    {
        var stageIds = logs.Select(x => x.TreatmentStageId).Distinct().ToList();
        List<TreatmentStage> stages;
        using (DataFilter.Disable<ISoftDelete>())
        {
            stages = await _repository.GetListAsync(x => stageIds.Contains(x.Id));
        }

        var stageById = stages.ToDictionary(x => x.Id);
        var serviceIds = stages.Select(x => x.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.WithDetailsAsync(c => c.Stages);
        var entries = catalogQuery.Where(c => serviceIds.Contains(c.Id)).ToList();
        var serviceNames = entries.ToDictionary(c => c.Id, c => c.Name);

        var names = new Dictionary<Guid, string>();
        foreach (var step in entries.SelectMany(c => c.Stages))
        {
            names.TryAdd(step.Id, step.Name);
        }

        var userIds = logs.SelectMany(TreatmentStageChangeDescriber.ReferencedIds).Distinct()
            .Where(id => !names.ContainsKey(id))
            .ToList();
        if (userIds.Count > 0)
        {
            foreach (var user in await _userRepository.GetListByIdsAsync(userIds))
            {
                names[user.Id] = user.Name ?? user.UserName;
            }
        }

        return logs.Select(x =>
        {
            var stage = stageById.GetValueOrDefault(x.TreatmentStageId);
            return new TreatmentStageChangeLogDto
            {
                Id = x.Id,
                TreatmentStageId = x.TreatmentStageId,
                Action = x.Action,
                Before = x.Before,
                After = x.After,
                ActorUserId = x.ActorUserId,
                ActorName = x.ActorName,
                OccurredAt = x.OccurredAt,
                StageName = stage is null ? string.Empty : serviceNames.GetValueOrDefault(stage.ServiceId) ?? stage.Name,
                StageTreatmentDate = stage?.TreatmentDate,
                StageDeleted = stage is null || stage.IsDeleted,
                Changes = TreatmentStageChangeDescriber.Describe(x, names),
            };
        }).ToList();
    }

    /// <summary>
    /// "Tiếp tục công đoạn" / "Tiếp tục bảo hành". Measured on staging
    /// 2026-09-24: <c>POST patient-stages/{id}/continue</c> answers 201 with a
    /// **new** công đoạn — same line, teeth and warranty flag, the visit's own
    /// doctor, note and steps — and the one it continued comes back
    /// <c>disabled</c>.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Continue)]
    public async Task<TreatmentStageDto> ContinueAsync(Guid id, ContinueTreatmentStageDto input)
    {
        var stage = await LoadWritableAsync(id);

        var others = new List<(TreatmentStage Stage, IEnumerable<int>? ToothCodes)>();
        foreach (var source in input.AlsoFrom.GroupBy(x => x.StageId).Select(g => g.Last()))
        {
            others.Add((await LoadWritableAsync(source.StageId), source.ToothCodes));
        }

        var next = stage.ContinueAs(
            GuidGenerator.Create(),
            await NextSequenceNumberAsync(stage.TreatmentServiceId),
            input.StaffId,
            input.Note.Trim(),
            input.SecondStaffId,
            input.SubStaffId,
            input.ServiceItemIds,
            input.ToothCodes,
            others,
            input.TreatmentDate);
        next.SetRemark(input.Remark);

        await _repository.UpdateAsync(stage);
        foreach (var (other, _) in others)
        {
            await _repository.UpdateAsync(other);
        }
        await _repository.InsertAsync(next, autoSave: true);

        await MoveServiceLineAsync(next);

        // Sau điều trị CSKH follows "Tiếp tục công đoạn" only — a warranty
        // continue is not named as a trigger (owner, 2026-10-05).
        if (!next.IsGuarantee)
        {
            await _afterTreatmentCare.RecordVisitAsync(next, Clock.Now);
        }

        return MapToDto(next, await BuildLookupsAsync([next]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Complete)]
    public async Task<TreatmentStageDto> CompleteAsync(Guid id)
    {
        var stage = await LoadWritableAsync(id);
        await GuardNotDateLockedAsync(stage);
        await GuardNotLockedByLaboAsync(stage);
        stage.Complete();
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.Completed);
        await _repository.UpdateAsync(stage, autoSave: true);

        await MoveServiceLineAsync(stage);

        // Hoàn thành is a treatment visit too: a one-visit service is ticked
        // done without ever being continued (QA 2026-10-06). Warranty work
        // stays out, as it does for continue.
        if (!stage.IsGuarantee)
        {
            await _afterTreatmentCare.RecordVisitAsync(stage, Clock.Now);
        }

        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// Un-ticks Hoàn thành — the reference's <c>revert-status</c>. Gated by the
    /// same ability as completing it: the reference's own ability list for
    /// <c>treatmentStage</c> is read/create/update/continue/complete/print, with
    /// no separate one for the revert.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Complete)]
    public async Task<TreatmentStageDto> RevertAsync(Guid id)
    {
        var stage = await LoadWritableAsync(id);
        await GuardNotDateLockedAsync(stage);
        stage.Revert();
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.Reverted);
        await _repository.UpdateAsync(stage, autoSave: true);

        await MoveServiceLineAsync(stage);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// Ticks or unticks the steps under "BE:Treatment:StageList" — the reference's
    /// <c>PUT /v1/patient-stages/{id}/stage-service-items</c>. Gated by
    /// <c>update</c>, the ability the reference uses for editing a công đoạn's
    /// own fields; it has none of its own for this.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> UpdateServiceItemsAsync(
        Guid id,
        UpdateStageServiceItemsDto input)
    {
        var stage = await LoadWritableAsync(id);
        var before = TickedSteps(stage);

        stage.UpdateServiceItems(
            input.Items
                .GroupBy(item => item.CatalogServiceStageId)
                .ToDictionary(group => group.Key, group => group.Last().IsCompleted),
            Clock.Now,
            CurrentUser.Id);

        var after = TickedSteps(stage);
        if (before != after)
        {
            await _changes.RecordAsync(stage, TreatmentStageChangeAction.ServiceItemsUpdated, before, after);
        }

        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// Ghi chú. Gated by <c>update</c> like the treatment content, and open on
    /// every row, finished or continued (owner 2026-10-19, BA 2026-11-02);
    /// the change is logged.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> UpdateRemarkAsync(
        Guid id,
        UpdateTreatmentStageRemarkDto input)
    {
        var stage = await LoadWritableAsync(id);
        var before = stage.Remark;
        stage.SetRemark(input.Remark);
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.RemarkChanged, before, stage.Remark);
        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<TreatmentStageDto> AttachImageAsync(Guid id, AttachStageImageDto input)
    {
        var stage = await LoadWritableAsync(id);
        stage.AttachImage(input.ImageUrl);
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.ImageAdded, after: input.ImageUrl.Trim());
        await _repository.UpdateAsync(stage, autoSave: true);
        return MapToDto(stage, await BuildLookupsAsync([stage]));
    }

    /// <summary>
    /// Xóa a wrongly written row of Lịch sử điều trị — say one dated the 27th
    /// for work done on the 28th (BA 2026-11-02). Admin only.
    ///
    /// Only the head of a chain goes: nothing continued from it, no warranty
    /// raised on it, no Labo order still on it. The teeth it took by "Tiếp tục"
    /// go back to the rows it took them from, and the line is read again. Its
    /// pictures stay in the patient's Hình ảnh. A back-dated row took no teeth,
    /// so it goes without giving any back. The delete is logged.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var stage = await LoadAsync(id);
        var lineStages = await _repository.GetListAsync(x => x.TreatmentServiceId == stage.TreatmentServiceId);
        if ((stage.IsSuperseded && !stage.IsBackfill)
            || stage.ContinuedToothCodes.Count > 0
            || lineStages.Any(x => x.ContinuedFromId == stage.Id || x.WarrantyRootStageId == stage.Id))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.StageDeleteHasSuccessor);
        }

        if (await _laboRepository.AnyAsync(o => o.TreatmentStageId == stage.Id && o.Status != LaboStatus.Cancelled))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.StageDeleteHasLabo);
        }

        var givenBack = stage.IsBackfill ? new List<TreatmentStage>() : GiveTeethBack(stage, lineStages);
        await _changes.RecordAsync(stage, TreatmentStageChangeAction.Deleted, TreatmentStageChangeRecorder.Snapshot(stage));
        await _repository.DeleteAsync(stage, autoSave: true);
        if (givenBack.Count > 0)
        {
            await _repository.UpdateManyAsync(givenBack, autoSave: true);
        }

        await MoveServiceLineAsync(stage);
    }

    /// <summary>The steps ticked on a công đoạn, as the log keeps them.</summary>
    private static string TickedSteps(TreatmentStage stage) => string.Join(',', stage.ServiceItems
        .Where(item => item.IsCompleted)
        .Select(item => item.CatalogServiceStageId)
        .Order());

    /// <summary>
    /// The rows a continued công đoạn took its teeth from, each given its teeth
    /// back: for every tooth, the latest earlier row of the same kind that
    /// handed it on — the main source and any "alsoFrom" alike.
    /// </summary>
    private static List<TreatmentStage> GiveTeethBack(TreatmentStage stage, IReadOnlyList<TreatmentStage> lineStages)
    {
        if (!stage.ContinuedFromId.HasValue)
        {
            return [];
        }

        var earlier = lineStages
            .Where(x => x.Id != stage.Id && x.IsGuarantee == stage.IsGuarantee && x.CreationTime <= stage.CreationTime)
            .ToList();
        var givenBack = new HashSet<TreatmentStage>();
        foreach (var code in stage.Teeth.Select(t => t.ToothCode).Distinct())
        {
            var source = earlier
                .Where(x => x.ContinuedToothCodes.Contains(code))
                .MaxBy(x => x.CreationTime);
            if (source is not null)
            {
                source.TakeBackTeeth([code]);
                givenBack.Add(source);
            }
        }

        // A công đoạn with no teeth of its own stood for the whole line.
        var main = earlier.FirstOrDefault(x => x.Id == stage.ContinuedFromId);
        if (main is not null && main.Teeth.Count == 0)
        {
            main.TakeBackTeeth([]);
            givenBack.Add(main);
        }

        return givenBack.ToList();
    }

    /// <summary>
    /// Keeps the service line in step with its công đoạn: the line finishes once
    /// every stage of that line has, and goes back to work as soon as one of them
    /// is re-opened.
    ///
    /// Derived from the siblings rather than from the move that was just made, so
    /// completing and reverting both land on the same answer.
    ///
    /// ASSUMED — the reference shows a per-line "BE:Field:StatusProgress" but never
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

        if (plan == null || line == null)
        {
            return;
        }

        var stageQuery = await _repository.GetQueryableAsync();
        var lineStages = stageQuery.Where(x => x.TreatmentServiceId == line.Id).ToList();
        if (_lineProgress.Move(plan, line, lineStages))
        {
            await _planRepository.UpdateAsync(plan, autoSave: true);
        }
    }

    /// <summary>
    /// Hoàn thành, either way, belongs to the rows of the line's newest "Ngày
    /// điều trị" (BA 2026-11-02) — see <see cref="StageDateLock"/>.
    /// </summary>
    private async Task GuardNotDateLockedAsync(TreatmentStage stage)
    {
        var lineStages = await _repository.GetListAsync(x => x.TreatmentServiceId == stage.TreatmentServiceId);
        if (StageDateLock.IsLocked(stage, lineStages))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.StageDateLocked);
        }
    }

    /// <summary>
    /// Hoàn thành waits for the line's labo orders (P2910_03): the same rule
    /// the history greys the tick out by — see <see cref="LaboStagePolicy"/>.
    /// </summary>
    private async Task GuardNotLockedByLaboAsync(TreatmentStage stage)
    {
        // With teeth: the day the last tooth passed QC decides the lock (P3110 note 27).
        var orders = await _laboRepository.GetListAsync(
            o => o.TreatmentServiceId == stage.TreatmentServiceId,
            includeDetails: true);
        if (orders.Count > 0
            && _laboPolicy.LocksCompletion(stage, await StagesOfLineAsync(stage.TreatmentServiceId), orders))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.StageLockedByLabo,
                "A labo order of the service is not QC-passed yet.");
        }
    }

    private async Task<TreatmentStage> LoadAsync(Guid id)
    {
        var stage = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(stage.ClinicBranchId);
        return stage;
    }

    /// <summary>A công đoạn about to be written: its line must still be open (R-1186).</summary>
    private async Task<TreatmentStage> LoadWritableAsync(Guid id)
    {
        var stage = await LoadAsync(id);
        await _lineGuard.EnsureOpenAsync(stage.TreatmentServiceId);
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

    /// <summary>
    /// The teeth of the line a new công đoạn goes on. Empty when the công đoạn
    /// hangs off no slip yet, which leaves the teeth unchecked, as before.
    /// </summary>
    private async Task<IReadOnlyCollection<ToothSelection>> LineTeethAsync(
        Guid? treatmentId,
        Guid treatmentServiceId)
    {
        if (!treatmentId.HasValue)
        {
            return [];
        }

        var query = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = query.FirstOrDefault(x => x.Id == treatmentId.Value);
        var line = plan?.Services.FirstOrDefault(s => s.Id == treatmentServiceId);
        return line is null ? [] : line.Teeth;
    }

    /// <summary>Every công đoạn of one line, whatever branch the caller sees.</summary>
    private async Task<List<TreatmentStage>> StagesOfLineAsync(Guid treatmentServiceId)
    {
        var query = await _repository.GetQueryableAsync();
        return query.Where(x => x.TreatmentServiceId == treatmentServiceId).ToList();
    }

    /// <summary>The card a new warranty công đoạn names, checked valid today (REQ-F3..F5).</summary>
    private async Task<WarrantyCover> WarrantyCoverAsync(CreateTreatmentStageDto input)
    {
        var lineId = input.TreatmentServiceId;
        var cards = await _cardRepository.GetListAsync(c => c.TreatmentServiceId == lineId);
        var orderQuery = await _laboRepository.WithDetailsAsync();
        var orders = orderQuery.Where(o => o.TreatmentServiceId == lineId).ToList();

        return WarrantyCover.Resolve(
            input.WarrantyKind,
            input.WarrantyLaboOrderId,
            lineId,
            cards,
            orders,
            ClinicCalendar.DateOf(Clock.Now));
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

    /// <summary>
    /// The image requirement lives on the service's own configuration — the
    /// reference keeps it on the dialog's "BE:Perm:Settings" tab with the other service
    /// settings, not on the shared catalog row.
    /// </summary>
    private async Task<bool> ServiceRequiresImageAsync(Guid serviceId)
    {
        var query = await _catalogRepository.GetQueryableAsync();
        return query
            .Where(x => x.Id == serviceId)
            .Select(x => x.ServiceConfig != null && x.ServiceConfig.RequireImage)
            .FirstOrDefault();
    }

    private async Task<StageLookups> BuildLookupsAsync(IReadOnlyCollection<TreatmentStage> items)
    {
        var serviceIds = items.Select(x => x.ServiceId).Distinct().ToList();
        // All three slots resolve from one read: the row prints Bác sĩ, Bác sĩ hỗ
        // trợ and Phụ tá side by side.
        var staffIds = items
            .SelectMany(x => new[] { (Guid?)x.StaffId, x.SecondStaffId, x.SubStaffId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var catalogQuery = await _catalogRepository.WithDetailsAsync(c => c.Stages);
        var entries = catalogQuery.Where(c => serviceIds.Contains(c.Id)).ToList();
        var serviceNames = entries.ToDictionary(c => c.Id, c => c.Name);
        // "BE:Treatment:StageList" is named by the service, not copied onto the
        // công đoạn, so a rename in Danh mục shows through everywhere at once.
        var stageNames = entries
            .SelectMany(c => c.Stages)
            .GroupBy(x => x.Id)
            .ToDictionary(g => g.Key, g => g.First().Name);

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);

        return new StageLookups(
            serviceNames,
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName),
            StaffJobTitles.Of(users),
            stageNames,
            await LaboOfAsync(items),
            await DateLockedOfAsync(items));
    }

    /// <summary>
    /// The Labo chip, the Hoàn thành lock (and the order behind it) and the
    /// "BN có n phiếu" count of each công đoạn, read against every công đoạn of
    /// its line — a page of the history may hold only some of them.
    /// </summary>
    private async Task<IReadOnlyDictionary<Guid, StageLabo>> LaboOfAsync(IReadOnlyCollection<TreatmentStage> items)
    {
        var lineIds = items.Select(x => x.TreatmentServiceId).Distinct().ToList();
        var orderQuery = await _laboRepository.WithDetailsAsync();
        var ordersByLine = orderQuery
            .Where(o => o.TreatmentServiceId != null && lineIds.Contains(o.TreatmentServiceId.Value))
            .ToList()
            .GroupBy(o => o.TreatmentServiceId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());
        if (ordersByLine.Count == 0)
        {
            return new Dictionary<Guid, StageLabo>();
        }

        var laboLineIds = ordersByLine.Keys.ToList();
        var stageQuery = await _repository.GetQueryableAsync();
        var stagesByLine = stageQuery
            .Where(x => laboLineIds.Contains(x.TreatmentServiceId))
            .ToList()
            .GroupBy(x => x.TreatmentServiceId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var today = ClinicCalendar.DateOf(DateTimeOffset.UtcNow);
        TreatmentStageLaboDto? ChipOf(LaboOrder? order) => order is null ? null : new TreatmentStageLaboDto
        {
            OrderId = order.Id,
            OrderCode = order.OrderCode,
            Status = order.Status,
            IsWarrantyExpired = order.IsWarrantyExpiredOn(today),
            QualityPassedOn = order.QualityPassedOn
        };

        return items
            .Where(stage => ordersByLine.ContainsKey(stage.TreatmentServiceId))
            .ToDictionary(stage => stage.Id, stage =>
            {
                var orders = ordersByLine[stage.TreatmentServiceId];
                var siblings = stagesByLine.GetValueOrDefault(stage.TreatmentServiceId) ?? [stage];
                var lockingOrder = stage.Status == TreatmentStageStatus.Completed
                    ? null
                    : _laboPolicy.LockingOrder(stage, siblings, orders);
                return new StageLabo(
                    ChipOf(_laboPolicy.OrderRaisedOn(stage, orders)),
                    ChipOf(lockingOrder),
                    orders.Count(o => o.Status != LaboStatus.Cancelled));
            });
    }

    /// <summary>
    /// The công đoạn frozen by a newer "Ngày điều trị" on their line — see
    /// <see cref="StageDateLock"/>, whose rule the query below spells out: the
    /// line's newest day, Labo warranties apart, replaced rows included.
    /// </summary>
    private async Task<IReadOnlySet<Guid>> DateLockedOfAsync(IReadOnlyCollection<TreatmentStage> items)
    {
        var lineIds = items.Select(x => x.TreatmentServiceId).Distinct().ToList();
        var query = await _repository.GetQueryableAsync();
        var newestByLine = query
            .Where(x => lineIds.Contains(x.TreatmentServiceId)
                && !(x.IsGuarantee && x.WarrantyKind == WarrantyCardKind.Labo))
            .GroupBy(x => x.TreatmentServiceId)
            .Select(g => new { Line = g.Key, Day = g.Max(x => x.TreatmentDate) })
            .ToDictionary(x => x.Line, x => (DateOnly?)x.Day);

        return items
            .Where(stage => StageDateLock.IsLocked(stage, newestByLine.GetValueOrDefault(stage.TreatmentServiceId)))
            .Select(stage => stage.Id)
            .ToHashSet();
    }

    private sealed record StageLookups(
        IReadOnlyDictionary<Guid, string> ServiceNames,
        IReadOnlyDictionary<Guid, string> StaffNames,
        IReadOnlyDictionary<Guid, string> JobTitles,
        IReadOnlyDictionary<Guid, string> ServiceStageNames,
        IReadOnlyDictionary<Guid, StageLabo> Labo,
        IReadOnlySet<Guid> DateLocked);

    private sealed record StageLabo(
        TreatmentStageLaboDto? Chip,
        TreatmentStageLaboDto? LockingOrder,
        int LineOrderCount);

    private static string? NameOf(Guid? staffId, StageLookups lookups) =>
        staffId.HasValue && lookups.StaffNames.TryGetValue(staffId.Value, out var name) ? name : null;

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
        Remark = entity.Remark,
        StaffId = entity.StaffId,
        SecondStaffId = entity.SecondStaffId,
        SubStaffId = entity.SubStaffId,
        ScheduledDate = entity.ScheduledDate,
        TreatmentDate = entity.TreatmentDate,
        Status = entity.Status,
        IsImageRequired = entity.IsImageRequired,
        IsGuarantee = entity.IsGuarantee,
        HasReExamination = entity.HasReExamination,
        IsSuperseded = entity.IsSuperseded,
        IsBackfill = entity.IsBackfill,
        ContinuedToothCodes = entity.ContinuedToothCodes.ToList(),
        ContinuedFromId = entity.ContinuedFromId,
        WarrantyRootStageId = entity.WarrantyRootStageId,
        WarrantyKind = entity.WarrantyKind,
        WarrantyLaboOrderId = entity.WarrantyLaboOrderId,
        StartedAt = entity.StartedAt,
        CompletedAt = entity.CompletedAt,
        Teeth = PatientDiagnosisAppService.ToToothDtos(entity.Teeth),
        ImageUrls = entity.ImageUrls.ToList(),
        ServiceItems = entity.ServiceItems
            .Select(item => new StageServiceItemDto
            {
                CatalogServiceStageId = item.CatalogServiceStageId,
                Name = lookups.ServiceStageNames.TryGetValue(item.CatalogServiceStageId, out var step)
                    ? step
                    : string.Empty,
                IsCompleted = item.IsCompleted,
                CompletedAt = item.CompletedAt,
                StaffId = item.StaffId,
            })
            .ToList(),
        ServiceName = lookups.ServiceNames.TryGetValue(entity.ServiceId, out var service) ? service : null,
        StaffName = lookups.StaffNames.TryGetValue(entity.StaffId, out var staff) ? staff : null,
        SecondStaffName = NameOf(entity.SecondStaffId, lookups),
        StaffJobTitle = lookups.JobTitles.GetValueOrDefault(entity.StaffId),
        SecondStaffJobTitle = StaffJobTitles.Lookup(lookups.JobTitles, entity.SecondStaffId),
        SubStaffName = NameOf(entity.SubStaffId, lookups),
        Labo = lookups.Labo.GetValueOrDefault(entity.Id)?.Chip,
        CompleteLockedByLabo = lookups.Labo.GetValueOrDefault(entity.Id)?.LockingOrder is not null,
        CompleteLockedByLaboOrder = lookups.Labo.GetValueOrDefault(entity.Id)?.LockingOrder,
        LineLaboOrderCount = lookups.Labo.GetValueOrDefault(entity.Id)?.LineOrderCount ?? 0,
        IsDateLocked = lookups.DateLocked.Contains(entity.Id),
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
