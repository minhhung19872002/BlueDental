using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.PatientManagement;

/// <summary>
/// Bộ hồ sơ bệnh án — the bundles a patient's Bệnh án sheets are kept in, each
/// opened for one or more treatment slips. See <see cref="MedicalRecordSet"/>.
///
/// Guarded by the same rights as the sheets themselves: opening a set is adding
/// to the record, changing which slips it holds is editing it, and cancelling
/// it stands where deleting would.
/// </summary>
[Authorize]
public class MedicalRecordSetAppService : ApplicationService, IMedicalRecordSetAppService
{
    private readonly IRepository<MedicalRecordSet, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly IRepository<PatientDiagnosis, Guid> _diagnosisRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly MedicalRecordSheetFactsBuilder _sheetFacts;

    public MedicalRecordSetAppService(
        IRepository<MedicalRecordSet, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        IRepository<PatientDiagnosis, Guid> diagnosisRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        MedicalRecordSheetFactsBuilder sheetFacts)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _planRepository = planRepository;
        _adviseRepository = adviseRepository;
        _diagnosisRepository = diagnosisRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _sheetFacts = sheetFacts;
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<ListResultDto<MedicalRecordSetDto>> GetListAsync(Guid patientId)
    {
        await GetPatientInBranchAsync(patientId);

        var sets = await _repository.GetListAsync(x => x.PatientId == patientId, includeDetails: true);
        var dtos = await MapAsync(sets);

        // Live sets newest first; a cancelled one goes to the bottom.
        return new ListResultDto<MedicalRecordSetDto>(dtos
            .OrderBy(set => set.Status == MedicalRecordSetStatus.Cancelled)
            .ThenByDescending(set => set.CreationTime)
            .ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<ListResultDto<MedicalRecordSetPlanDto>> GetPlansAsync(Guid patientId)
    {
        await GetPatientInBranchAsync(patientId);

        var plans = await LoadPlansAsync(x => x.PatientId == patientId);
        var holders = await HoldersOfAsync(patientId);
        var details = await DescribeAsync(plans);

        return new ListResultDto<MedicalRecordSetPlanDto>(plans
            .OrderByDescending(plan => plan.CreationTime)
            .Select(plan =>
            {
                var dto = details[plan.Id];
                var holder = holders.GetValueOrDefault(plan.Id);
                dto.RecordSetId = holder?.Id;
                dto.RecordSetCode = holder?.Code;
                return dto;
            })
            .ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    public async Task<MedicalRecordSetDto> CreateAsync(CreateMedicalRecordSetDto input)
    {
        var patient = await GetPatientInBranchAsync(input.PatientId);

        var set = MedicalRecordSet.Open(
            GuidGenerator.Create(),
            patient.Id,
            patient.BranchId,
            await NextCodeAsync(patient),
            VisibleFormsOf(input.VisibleForms),
            await NextOutpatientSequenceAsync(patient));

        await HoldExactlyAsync(set, input.TreatmentPlanIds);
        await _repository.InsertAsync(set, autoSave: true);
        return (await MapAsync([set])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    public async Task<MedicalRecordSetDto> UpdateAsync(Guid id, UpdateMedicalRecordSetDto input)
    {
        var set = await GetInBranchAsync(id);

        set.ShowOnly(VisibleFormsOf(input.VisibleForms));
        await HoldExactlyAsync(set, input.TreatmentPlanIds);

        await _repository.UpdateAsync(set, autoSave: true);
        return (await MapAsync([set])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    public async Task<MedicalRecordSetDto> CancelAsync(Guid id)
    {
        var set = await GetInBranchAsync(id);

        set.Cancel(Clock.Now, CurrentUser.Id);

        await _repository.UpdateAsync(set, autoSave: true);
        return (await MapAsync([set])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<MedicalRecordSheetFactsDto> GetSheetFactsAsync(Guid id)
    {
        var set = await GetInBranchAsync(id);
        var patient = await _patientRepository.GetAsync(set.PatientId);
        return await _sheetFacts.BuildAsync(set, patient);
    }

    /// <summary>
    /// Makes the set hold exactly <paramref name="planIds"/>: free slips may come
    /// in, slips not yet started may leave, and a slip another live set holds is
    /// refused — see <see cref="MedicalRecordSetPlanRules"/>.
    /// </summary>
    private async Task HoldExactlyAsync(MedicalRecordSet set, IReadOnlyCollection<Guid> planIds)
    {
        set.EnsureActive();

        var wanted = planIds.Distinct().ToList();
        if (wanted.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.MedicalRecordSetNeedsPlan);
        }

        var leaving = set.HeldPlans.Select(plan => plan.TreatmentPlanId).Except(wanted).ToList();
        var involved = wanted.Union(leaving).ToList();
        var plans = (await LoadPlansAsync(x => involved.Contains(x.Id))).ToDictionary(plan => plan.Id);

        foreach (var planId in leaving)
        {
            // A slip deleted since still leaves; there is no record left to guard.
            if (plans.TryGetValue(planId, out var plan))
            {
                MedicalRecordSetPlanRules.EnsureCanLeave(plan);
            }

            set.Detach(planId);
        }

        var otherSets = (await _repository.GetListAsync(
                x => x.PatientId == set.PatientId && x.Id != set.Id && x.Status == MedicalRecordSetStatus.Active,
                includeDetails: true))
            .ToList();

        var now = Clock.Now;
        foreach (var planId in wanted.Where(planId => !set.Holds(planId)))
        {
            var plan = plans.GetValueOrDefault(planId)
                ?? throw new EntityNotFoundException(typeof(TreatmentPlan), planId);
            var holder = otherSets.FirstOrDefault(other => other.Holds(planId));

            MedicalRecordSetPlanRules.EnsureCanJoin(plan, set, holder);

            set.Attach(planId, plan.DentistId, now);
        }
    }

    /// <summary><c>HS{patient code}-{DDMMYYYY}-{nn}</c>: nn counts the patient's sets opened that clinic day.</summary>
    private async Task<string> NextCodeAsync(Patient patient)
    {
        var day = ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc)));
        var prefix = MedicalRecordSet.CodePrefixFor(patient.PatientCode, day);

        // Counted with deleted rows too: a number once given is never given again.
        using (DataFilter.Disable<ISoftDelete>())
        {
            var query = await _repository.GetQueryableAsync();
            var taken = await AsyncExecuter.CountAsync(query.Where(x => x.Code.StartsWith(prefix)));
            return MedicalRecordSet.CodeFor(patient.PatientCode, day, taken + 1);
        }
    }

    /// <summary>
    /// The xxxx of Số ngoại trú: the sets the branch opened this clinic day,
    /// deleted ones too, so a number is never given twice.
    /// </summary>
    private async Task<int> NextOutpatientSequenceAsync(Patient patient)
    {
        var day = ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(Clock.Now, DateTimeKind.Utc)));
        var from = ClinicCalendar.StartOfDay(day).UtcDateTime;
        var to = ClinicCalendar.StartOfDay(day.AddDays(1)).UtcDateTime;

        using (DataFilter.Disable<ISoftDelete>())
        {
            var query = await _repository.GetQueryableAsync();
            var opened = await AsyncExecuter.CountAsync(query.Where(x =>
                x.ClinicBranchId == patient.BranchId && x.CreationTime >= from && x.CreationTime < to));
            return opened + 1;
        }
    }

    private static IEnumerable<MedicalRecordForm> VisibleFormsOf(IReadOnlyCollection<MedicalRecordForm>? forms) =>
        forms is null || forms.Count == 0 ? MedicalRecordSet.AllForms : forms;

    /// <summary>Each slip of the patient that a live set holds, with that set.</summary>
    private async Task<Dictionary<Guid, MedicalRecordSet>> HoldersOfAsync(Guid patientId)
    {
        var sets = await _repository.GetListAsync(
            x => x.PatientId == patientId && x.Status == MedicalRecordSetStatus.Active,
            includeDetails: true);

        return sets
            .SelectMany(set => set.HeldPlans.Select(plan => (plan.TreatmentPlanId, set)))
            .GroupBy(pair => pair.TreatmentPlanId)
            .ToDictionary(group => group.Key, group => group.First().set);
    }

    private async Task<List<TreatmentPlan>> LoadPlansAsync(System.Linq.Expressions.Expression<Func<TreatmentPlan, bool>> predicate)
    {
        var query = await _planRepository.WithDetailsAsync(plan => plan.Services);
        return await AsyncExecuter.ToListAsync(query.Where(predicate));
    }

    private async Task<List<MedicalRecordSetDto>> MapAsync(IReadOnlyCollection<MedicalRecordSet> sets)
    {
        var planIds = sets.SelectMany(set => set.Plans).Select(plan => plan.TreatmentPlanId).Distinct().ToList();

        // A slip deleted since still names the set it was opened for.
        List<TreatmentPlan> plans;
        using (DataFilter.Disable<ISoftDelete>())
        {
            plans = await LoadPlansAsync(x => planIds.Contains(x.Id));
        }

        var details = await DescribeAsync(plans);
        var cancellers = await NamesOfAsync(sets.Where(set => set.CancelledById.HasValue).Select(set => set.CancelledById!.Value));

        return sets.Select(set =>
        {
            // A live set lists what it holds; a cancelled one what it was opened for.
            var links = set.IsCancelled ? set.Plans : set.HeldPlans;

            return new MedicalRecordSetDto
            {
                Id = set.Id,
                PatientId = set.PatientId,
                ClinicBranchId = set.ClinicBranchId,
                Code = set.Code,
                Status = set.Status,
                CancelledAt = set.CancelledAt,
                CancelledById = set.CancelledById,
                CancellerName = set.CancelledById.HasValue ? cancellers.GetValueOrDefault(set.CancelledById.Value) : null,
                VisibleForms = set.VisibleForms.ToList(),
                CreationTime = set.CreationTime,
                CreatorId = set.CreatorId,
                Plans = links
                    .Where(link => details.ContainsKey(link.TreatmentPlanId))
                    .Select(link =>
                    {
                        var dto = details[link.TreatmentPlanId];
                        return new MedicalRecordSetPlanDto
                        {
                            TreatmentPlanId = dto.TreatmentPlanId,
                            PlanCode = dto.PlanCode,
                            CreationTime = dto.CreationTime,
                            DiagnosisSlipCode = dto.DiagnosisSlipCode,
                            DiagnosisName = dto.DiagnosisName,
                            TreatmentName = dto.TreatmentName,
                            PlanStatus = dto.PlanStatus,
                            NotStarted = dto.NotStarted,
                            // The doctor the slip had when it joined: each slip keeps its own.
                            DentistId = link.DentistId,
                            DentistName = link.DentistId == dto.DentistId ? dto.DentistName : null,
                            RecordSetId = set.IsCancelled ? null : set.Id,
                            RecordSetCode = set.IsCancelled ? null : set.Code,
                        };
                    })
                    .OrderByDescending(plan => plan.CreationTime)
                    .ToList(),
            };
        }).ToList();
    }

    /// <summary>
    /// What a slip treats, read back the way the clinic made it: its lines were
    /// pulled from consulting lines, and those name the diagnosis slip (CD…) and
    /// the diagnosis. A slip built by hand falls back to a line's own diagnosis.
    /// </summary>
    private async Task<Dictionary<Guid, MedicalRecordSetPlanDto>> DescribeAsync(IReadOnlyCollection<TreatmentPlan> plans)
    {
        var planIds = plans.Select(plan => plan.Id).ToList();
        var lines = plans
            .SelectMany(plan => plan.Services)
            .Where(line => line.Status != TreatmentServiceStatus.Cancelled)
            .OrderBy(line => line.SortOrder)
            .ToList();
        var sourceIds = lines.Where(line => line.SourceAdviseId.HasValue).Select(line => line.SourceAdviseId!.Value).ToList();

        var adviseQuery = await _adviseRepository.GetQueryableAsync();
        var advises = await AsyncExecuter.ToListAsync(adviseQuery.Where(advise =>
            sourceIds.Contains(advise.Id) || (advise.TreatmentPlanId.HasValue && planIds.Contains(advise.TreatmentPlanId.Value))));

        var slipIds = advises.Where(a => a.PatientDiagnosisId.HasValue).Select(a => a.PatientDiagnosisId!.Value).Distinct().ToList();
        Dictionary<Guid, PatientDiagnosis> slips;
        using (DataFilter.Disable<ISoftDelete>())
        {
            var slipQuery = await _diagnosisRepository.GetQueryableAsync();
            slips = (await AsyncExecuter.ToListAsync(slipQuery.Where(slip => slipIds.Contains(slip.Id))))
                .ToDictionary(slip => slip.Id);
        }

        var catalogIds = lines.Select(line => line.ServiceId)
            .Concat(lines.Where(line => line.DiagnosisId.HasValue).Select(line => line.DiagnosisId!.Value))
            .Concat(advises.Where(a => a.DiagnosisId.HasValue).Select(a => a.DiagnosisId!.Value))
            .Concat(slips.Values.Select(slip => slip.DiagnosisId))
            .Distinct()
            .ToList();
        Dictionary<Guid, string> catalog;
        using (DataFilter.Disable<ISoftDelete>())
        {
            var catalogQuery = await _catalogRepository.GetQueryableAsync();
            catalog = (await AsyncExecuter.ToListAsync(catalogQuery.Where(entry => catalogIds.Contains(entry.Id))))
                .ToDictionary(entry => entry.Id, entry => entry.Name);
        }

        var dentists = await NamesOfAsync(plans.Select(plan => plan.DentistId));
        var adviseById = advises.ToDictionary(advise => advise.Id);

        return plans.ToDictionary(plan => plan.Id, plan =>
        {
            var own = lines.Where(line => line.TreatmentPlanId == plan.Id).ToList();
            var sources = own
                .Where(line => line.SourceAdviseId.HasValue && adviseById.ContainsKey(line.SourceAdviseId.Value))
                .Select(line => adviseById[line.SourceAdviseId!.Value])
                .Concat(advises.Where(advise => advise.TreatmentPlanId == plan.Id))
                .ToList();

            var slip = sources
                .Where(advise => advise.PatientDiagnosisId.HasValue && slips.ContainsKey(advise.PatientDiagnosisId.Value))
                .Select(advise => slips[advise.PatientDiagnosisId!.Value])
                .FirstOrDefault();

            var diagnosisId = slip?.DiagnosisId
                ?? own.FirstOrDefault(line => line.DiagnosisId.HasValue)?.DiagnosisId
                ?? sources.FirstOrDefault(advise => advise.DiagnosisId.HasValue)?.DiagnosisId;

            var treatment = own
                .Select(line => catalog.GetValueOrDefault(line.ServiceId))
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct()
                .ToList();

            return new MedicalRecordSetPlanDto
            {
                TreatmentPlanId = plan.Id,
                PlanCode = plan.Code,
                CreationTime = plan.CreationTime,
                DiagnosisSlipCode = slip?.Code,
                DiagnosisName = diagnosisId.HasValue ? catalog.GetValueOrDefault(diagnosisId.Value) : null,
                TreatmentName = treatment.Count == 0 ? plan.Title : string.Join(", ", treatment),
                DentistId = plan.DentistId,
                DentistName = dentists.GetValueOrDefault(plan.DentistId),
                PlanStatus = plan.Status,
                NotStarted = MedicalRecordSetPlanRules.IsNotStarted(plan),
            };
        });
    }

    private async Task<Dictionary<Guid, string>> NamesOfAsync(IEnumerable<Guid> userIds)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, string>();

        return (await _userRepository.GetListByIdsAsync(ids))
            .ToDictionary(user => user.Id, user => user.Name ?? user.UserName);
    }

    private async Task<Patient> GetPatientInBranchAsync(Guid patientId)
    {
        var patient = await _patientRepository.GetAsync(patientId);
        if (!await _branchAccess.IsAllowedAsync(patient.BranchId))
        {
            throw new EntityNotFoundException(typeof(Patient), patientId);
        }

        return patient;
    }

    /// <summary>A set another branch holds is reported missing, never forbidden.</summary>
    private async Task<MedicalRecordSet> GetInBranchAsync(Guid id)
    {
        var set = await _repository.GetAsync(id, includeDetails: true);
        if (!await _branchAccess.IsAllowedAsync(set.ClinicBranchId))
        {
            throw new EntityNotFoundException(typeof(MedicalRecordSet), id);
        }

        return set;
    }
}
