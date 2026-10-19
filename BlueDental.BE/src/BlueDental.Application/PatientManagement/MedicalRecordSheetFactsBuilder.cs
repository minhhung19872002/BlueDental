using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;

namespace BlueDental.PatientManagement;

/// <summary>
/// Reads what the sheets of a bộ hồ sơ bệnh án print about its treatment slips —
/// the clinic's mapping in save/P1810.drawio. The rules for the dates are
/// <see cref="MedicalRecordTreatmentDates"/>'s; this only gathers and names.
/// </summary>
public class MedicalRecordSheetFactsBuilder : ITransientDependency
{
    /// <summary>Where the staff screen keeps a person's Chức vụ (StaffAppService).</summary>
    private const string PositionProperty = "Position";

    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly IAsyncQueryableExecuter _executer;
    private readonly IDataFilter _dataFilter;

    public MedicalRecordSheetFactsBuilder(
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        IAsyncQueryableExecuter executer,
        IDataFilter dataFilter)
    {
        _planRepository = planRepository;
        _stageRepository = stageRepository;
        _adviseRepository = adviseRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _executer = executer;
        _dataFilter = dataFilter;
    }

    public async Task<MedicalRecordSheetFactsDto> BuildAsync(MedicalRecordSet set, Patient patient)
    {
        // A cancelled set still prints the slips it was opened for.
        var links = (set.IsCancelled ? set.Plans : set.HeldPlans).ToList();
        var planIds = links.Select(link => link.TreatmentPlanId).ToList();

        var planQuery = await _planRepository.WithDetailsAsync(plan => plan.Services);
        // A deleted slip is gone through the soft-delete filter; a cancelled one is left out here.
        var plans = (await _executer.ToListAsync(planQuery.Where(plan => planIds.Contains(plan.Id))))
            .Where(MedicalRecordTreatmentDates.Counts)
            .OrderBy(plan => plan.CreationTime)
            .ToList();

        var lines = plans
            .SelectMany(plan => plan.Services
                .Where(MedicalRecordTreatmentDates.Counts)
                .OrderBy(line => line.SortOrder)
                .ThenBy(line => line.Code))
            .ToList();
        var lineIds = lines.Select(line => line.Id).ToList();

        var stageQuery = await _stageRepository.GetQueryableAsync();
        var stages = await _executer.ToListAsync(stageQuery.Where(stage => lineIds.Contains(stage.TreatmentServiceId)));

        var adviseIds = lines.Where(line => line.SourceAdviseId.HasValue).Select(line => line.SourceAdviseId!.Value).ToList();
        Dictionary<Guid, PatientAdvise> advises;
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var adviseQuery = await _adviseRepository.GetQueryableAsync();
            advises = (await _executer.ToListAsync(adviseQuery.Where(advise => adviseIds.Contains(advise.Id))))
                .ToDictionary(advise => advise.Id);
        }

        Guid? DiagnosisOf(TreatmentService line) =>
            line.DiagnosisId
            ?? (line.SourceAdviseId.HasValue ? advises.GetValueOrDefault(line.SourceAdviseId.Value)?.DiagnosisId : null);

        var catalog = await CatalogAsync(lines.Select(line => line.ServiceId)
            .Concat(lines.Select(DiagnosisOf).Where(id => id.HasValue).Select(id => id!.Value)));

        var people = await PeopleAsync(links.Select(link => link.DentistId)
            .Concat(advises.Values.Select(advise => advise.StaffId))
            .Concat(stages.Select(stage => stage.StaffId)));

        var linkOf = links.ToDictionary(link => link.TreatmentPlanId);
        var lineById = lines.ToDictionary(line => line.Id);
        var planEnds = plans.ToDictionary(plan => plan.Id, plan => MedicalRecordTreatmentDates.EndOf(plan, stages));
        var first = plans.FirstOrDefault();
        var start = MedicalRecordTreatmentDates.StartOf(stages);

        return new MedicalRecordSheetFactsDto
        {
            StorageCode = first is null
                ? null
                : MedicalRecordSet.StorageCodeFor(ClinicDayOf(set.CreationTime), patient.PatientCode, first.Code),
            // MMyy of the treatment start; before any công đoạn, of the day the set was opened.
            OutpatientNumber = set.OutpatientSequence > 0
                ? MedicalRecordSet.OutpatientNumberFor(
                    patient.PatientCode, start ?? ClinicDayOf(set.CreationTime), set.OutpatientSequence)
                : null,
            Year = first is null ? null : ClinicDayOf(first.CreationTime).Year,
            TreatmentStartDate = start,
            TreatmentEndDate = MedicalRecordTreatmentDates.EndOfAll(planEnds.Values.ToList()),
            Plans = plans.Select(plan =>
            {
                // The doctor the slip had when it joined: each slip keeps its own.
                var dentist = people.GetValueOrDefault(linkOf[plan.Id].DentistId);
                return new MedicalRecordSheetPlanDto
                {
                    TreatmentPlanId = plan.Id,
                    PlanCode = plan.Code,
                    CreationTime = plan.CreationTime,
                    AttachedAt = linkOf[plan.Id].AttachedAt,
                    DentistName = dentist?.Name,
                    DentistPosition = dentist?.Position,
                    EndDate = planEnds[plan.Id],
                };
            }).ToList(),
            Services = lines.Select(line =>
            {
                var advise = line.SourceAdviseId.HasValue ? advises.GetValueOrDefault(line.SourceAdviseId.Value) : null;
                var diagnosis = CatalogOf(catalog, DiagnosisOf(line));
                return new MedicalRecordSheetServiceDto
                {
                    TreatmentPlanId = line.TreatmentPlanId,
                    ServiceName = CatalogOf(catalog, line.ServiceId)?.Name ?? string.Empty,
                    ToothCodes = line.Teeth.Select(tooth => tooth.ToothCode).ToList(),
                    DiagnosisCode = diagnosis?.Code,
                    DiagnosisName = diagnosis?.Name,
                    Amount = line.EffectiveAmount,
                    ConsultedAt = advise?.CreationTime,
                    ConsultantName = advise is null ? null : people.GetValueOrDefault(advise.StaffId)?.Name,
                };
            }).ToList(),
            Visits = stages
                .OrderBy(stage => stage.TreatmentDate)
                .ThenBy(stage => stage.CreationTime)
                .Select(stage =>
                {
                    var line = lineById[stage.TreatmentServiceId];
                    var diagnosis = CatalogOf(catalog, DiagnosisOf(line));
                    return new MedicalRecordSheetVisitDto
                    {
                        TreatmentDate = stage.TreatmentDate,
                        RecordedAt = stage.CreationTime,
                        ServiceName = CatalogOf(catalog, line.ServiceId)?.Name ?? stage.Name,
                        // A công đoạn names the teeth it worked; one that names none worked the line's.
                        ToothCodes = (stage.Teeth.Count > 0 ? stage.Teeth : line.Teeth)
                            .Select(tooth => tooth.ToothCode)
                            .ToList(),
                        DiagnosisCode = diagnosis?.Code,
                        DiagnosisName = diagnosis?.Name,
                        Content = stage.Note,
                        DoctorName = people.GetValueOrDefault(stage.StaffId)?.Name,
                    };
                })
                .ToList(),
        };
    }

    private static DateOnly ClinicDayOf(DateTime instant) =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(instant, DateTimeKind.Utc)));

    private static CatalogEntry? CatalogOf(IReadOnlyDictionary<Guid, CatalogEntry> catalog, Guid? id) =>
        id.HasValue ? catalog.GetValueOrDefault(id.Value) : null;

    /// <summary>Services and diagnoses by id — deleted ones too: a slip keeps naming what it was opened with.</summary>
    private async Task<Dictionary<Guid, CatalogEntry>> CatalogAsync(IEnumerable<Guid> ids)
    {
        var wanted = ids.Distinct().ToList();
        using (_dataFilter.Disable<ISoftDelete>())
        {
            var query = await _catalogRepository.GetQueryableAsync();
            return (await _executer.ToListAsync(query.Where(entry => wanted.Contains(entry.Id))))
                .ToDictionary(entry => entry.Id);
        }
    }

    private async Task<Dictionary<Guid, Person>> PeopleAsync(IEnumerable<Guid> ids)
    {
        var wanted = ids.Distinct().ToList();
        if (wanted.Count == 0) return new Dictionary<Guid, Person>();

        return (await _userRepository.GetListByIdsAsync(wanted)).ToDictionary(
            user => user.Id,
            user => new Person(
                user.Name ?? user.UserName,
                (user.ExtraProperties.GetOrDefault(PositionProperty) as string)?.Trim() is { Length: > 0 } position ? position : null));
    }

    private sealed record Person(string Name, string? Position);
}
