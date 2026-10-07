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
/// Đơn thuốc of one patient — the list on the "BE:Common:Prescriptions" tab and the
/// "BE:Treatment:AddPrescription" dialog (create, edit, delete).
/// </summary>
[Authorize]
public class PrescriptionAppService : ApplicationService, IPrescriptionAppService
{
    /// <summary>Name of the group a template lands in when the branch has none yet.</summary>
    private const string DefaultTemplateGroupName = "Đơn thuốc mẫu";

    private readonly IRepository<Prescription, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;
    private readonly IRepository<PatientDiagnosis, Guid> _patientDiagnosisRepository;

    public PrescriptionAppService(
        IRepository<Prescription, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientAdvise, Guid> adviseRepository,
        IRepository<PatientDiagnosis, Guid> patientDiagnosisRepository)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _taxonomyRepository = taxonomyRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _planRepository = planRepository;
        _adviseRepository = adviseRepository;
        _patientDiagnosisRepository = patientDiagnosisRepository;
    }

    /// <summary>
    /// The "Phiếu điều trị" picker of the Chẩn đoán block (F-58): every
    /// diagnosis on the patient's phiếu điều trị in this branch, one row per
    /// (phiếu, chẩn đoán), newest phiếu first. Cancelled phiếu and cancelled,
    /// replaced or transferred lines are left out; a line with no diagnosis
    /// has nothing to offer and is skipped.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<ListResultDto<PrescriptionDiagnosisSourceDto>> GetDiagnosisSourcesAsync(
        GetPrescriptionDiagnosisSourcesInput input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        return new ListResultDto<PrescriptionDiagnosisSourceDto>(
            await LoadDiagnosisSourcesAsync(input.PatientId, input.ClinicBranchId));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input)
    {
        var branchIds = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        var query = await _repository.WithDetailsAsync(x => x.Items, x => x.Diagnoses);

        // An empty filter means the caller is clinic-wide and named no branch.
        if (branchIds.Count > 0)
            query = query.Where(x => branchIds.Contains(x.ClinicBranchId));

        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);

        var total = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(
            query.OrderByDescending(x => x.IssuedAt)
                .ThenByDescending(x => x.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PagedResultDto<PrescriptionDto>(total, await MapManyAsync(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PrescriptionDto> GetAsync(Guid id)
    {
        return await MapAsync(await LoadAsync(id));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Create)]
    public async Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        GuardTemplateName(input.SaveAsTemplate, input.TemplateName);

        var items = await BuildItemsAsync(input.ClinicBranchId, input.Items);
        var diagnoses = await BuildDiagnosesAsync(
            input.PatientId, input.ClinicBranchId, input.Diagnoses, kept: []);

        var prescription = Prescription.Issue(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            await GenerateCodeAsync(input.ClinicBranchId),
            input.StaffId,
            items,
            input.DiagnosisText,
            input.Note,
            input.TreatmentType,
            input.FollowUpDate,
            Clock.Now,
            diagnoses,
            input.DiagnosisNote);

        await _repository.InsertAsync(prescription, autoSave: true);

        if (input.SaveAsTemplate)
            await SaveTemplateAsync(prescription, input.TemplateName!);

        return await MapAsync(prescription);
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Update)]
    public async Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input)
    {
        var prescription = await LoadAsync(id);
        GuardTemplateName(input.SaveAsTemplate, input.TemplateName);

        var items = await BuildItemsAsync(prescription.ClinicBranchId, input.Items);
        var diagnoses = await BuildDiagnosesAsync(
            prescription.PatientId, prescription.ClinicBranchId, input.Diagnoses, prescription.Diagnoses);

        prescription.UpdateDetails(
            input.StaffId,
            input.DiagnosisText,
            input.Note,
            input.TreatmentType,
            input.FollowUpDate,
            items,
            diagnoses,
            input.DiagnosisNote);

        await _repository.UpdateAsync(prescription, autoSave: true);

        if (input.SaveAsTemplate)
            await SaveTemplateAsync(prescription, input.TemplateName!);

        return await MapAsync(prescription);
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var prescription = await LoadAsync(id);
        await _repository.DeleteAsync(prescription, autoSave: true);
    }

    private async Task<Prescription> LoadAsync(Guid id)
    {
        var prescription = await AsyncExecuter.FirstOrDefaultAsync(
            (await _repository.WithDetailsAsync(x => x.Items, x => x.Diagnoses)).Where(x => x.Id == id));

        if (prescription == null || !await _branchAccess.IsAllowedAsync(prescription.ClinicBranchId))
        {
            // Another branch's slip reads as "not found" rather than "forbidden",
            // so a caller cannot probe which ids exist elsewhere.
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                $"Prescription {id} was not found.");
        }

        return prescription;
    }

    /// <summary>
    /// Turns the posted lines into entities, snapshotting each medicine's name
    /// from the branch's "BE:Common:MedicineType" catalog. A medicine outside that catalog
    /// (another branch's, deleted, or not a medicine) is refused.
    /// </summary>
    private async Task<List<PrescriptionItem>> BuildItemsAsync(
        Guid clinicBranchId,
        IReadOnlyList<CreatePrescriptionItemDto> lines)
    {
        var medicationIds = lines.Select(l => l.MedicationId).Distinct().ToList();

        var medicines = await _catalogRepository.GetListAsync(c =>
            medicationIds.Contains(c.Id)
            && c.ClinicBranchId == clinicBranchId
            && c.Group == TaxonomyGroups.MedicationType);

        var names = medicines.ToDictionary(c => c.Id, c => c.Name);

        var missing = medicationIds.FirstOrDefault(id => !names.ContainsKey(id));
        if (missing != Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                $"Medicine {missing} is not in this branch's catalog.");
        }

        return lines.Select((line, index) => new PrescriptionItem(
            GuidGenerator.Create(),
            line.MedicationId,
            names[line.MedicationId],
            line.Morning,
            line.Noon,
            line.Afternoon,
            line.Evening,
            line.Days,
            line.Usage,
            line.OtherUsage,
            index)).ToList();
    }

    /// <summary>
    /// Turns the picked (phiếu, chẩn đoán) pairs into snapshots built from the
    /// database, never from what the client claims. A pick the slip already
    /// holds keeps its snapshot, so a slip stays editable after its phiếu điều
    /// trị is cancelled; any new pick must be a live source of this patient in
    /// this branch.
    /// </summary>
    private async Task<List<PrescriptionDiagnosis>> BuildDiagnosesAsync(
        Guid patientId,
        Guid clinicBranchId,
        IReadOnlyList<PrescriptionDiagnosisInput>? picks,
        IReadOnlyCollection<PrescriptionDiagnosis> kept)
    {
        if (picks == null || picks.Count == 0)
            return [];

        var keptByPair = kept.ToDictionary(d => (d.TreatmentPlanId, d.DiagnosisId));
        var sources = picks.All(p => keptByPair.ContainsKey((p.TreatmentPlanId, p.DiagnosisId)))
            ? new Dictionary<(Guid, Guid), PrescriptionDiagnosisSourceDto>()
            : (await LoadDiagnosisSourcesAsync(patientId, clinicBranchId))
                .ToDictionary(x => (x.TreatmentPlanId, x.DiagnosisId));

        return picks.Select((pick, index) =>
        {
            var pair = (pick.TreatmentPlanId, pick.DiagnosisId);

            if (sources.TryGetValue(pair, out var source))
            {
                return new PrescriptionDiagnosis(
                    GuidGenerator.Create(), source.TreatmentPlanId, source.DiagnosisId,
                    source.PlanCode, source.DiagnosisName, source.ToothCodes, index);
            }

            if (keptByPair.TryGetValue(pair, out var old))
            {
                return new PrescriptionDiagnosis(
                    GuidGenerator.Create(), old.TreatmentPlanId, old.DiagnosisId,
                    old.PlanCode, old.DiagnosisName, old.ToothCodeList(), index);
            }

            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionDiagnosisSourceInvalid,
                $"Diagnosis {pick.DiagnosisId} of treatment plan {pick.TreatmentPlanId} is not a live source of this patient.");
        }).ToList();
    }

    private async Task<List<PrescriptionDiagnosisSourceDto>> LoadDiagnosisSourcesAsync(
        Guid patientId,
        Guid clinicBranchId)
    {
        var plans = await AsyncExecuter.ToListAsync(
            (await _planRepository.WithDetailsAsync(p => p.Services))
                .Where(p => p.PatientId == patientId
                            && p.BranchId == clinicBranchId
                            && p.Status != TreatmentPlanStatus.Cancelled));

        var lines = plans
            .SelectMany(p => p.Services.Select(line => (Plan: p, Line: line)))
            .Where(x => x.Line.Status is not (TreatmentServiceStatus.Cancelled
                or TreatmentServiceStatus.Replaced
                or TreatmentServiceStatus.Transferred))
            .ToList();

        // Lines pulled from Tư vấn carry their diagnosis on the advise, and its
        // note on the phiếu chẩn đoán behind that advise.
        var adviseIds = lines
            .Where(x => x.Line.SourceAdviseId.HasValue)
            .Select(x => x.Line.SourceAdviseId!.Value)
            .Distinct()
            .ToList();
        var advises = adviseIds.Count == 0
            ? new Dictionary<Guid, PatientAdvise>()
            : (await _adviseRepository.GetListAsync(a => adviseIds.Contains(a.Id)))
                .ToDictionary(a => a.Id);

        var slipIds = advises.Values
            .Where(a => a.PatientDiagnosisId.HasValue)
            .Select(a => a.PatientDiagnosisId!.Value)
            .Distinct()
            .ToList();
        var slips = slipIds.Count == 0
            ? new Dictionary<Guid, PatientDiagnosis>()
            : (await _patientDiagnosisRepository.GetListAsync(d => slipIds.Contains(d.Id)))
                .ToDictionary(d => d.Id);

        var resolved = lines
            .Select(x =>
            {
                var advise = x.Line.SourceAdviseId is { } adviseId ? advises.GetValueOrDefault(adviseId) : null;
                var slip = advise?.PatientDiagnosisId is { } slipId ? slips.GetValueOrDefault(slipId) : null;
                var note = string.IsNullOrWhiteSpace(x.Line.Note) ? slip?.Note : x.Line.Note;

                return (
                    x.Plan,
                    x.Line,
                    DiagnosisId: x.Line.DiagnosisId ?? advise?.DiagnosisId ?? slip?.DiagnosisId,
                    Note: note?.Trim());
            })
            .Where(x => x.DiagnosisId.HasValue)
            .ToList();

        var diagnosisIds = resolved.Select(x => x.DiagnosisId!.Value).Distinct().ToList();
        var names = diagnosisIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _catalogRepository.GetListAsync(c => diagnosisIds.Contains(c.Id)))
                .ToDictionary(c => c.Id, c => c.Name);

        return resolved
            .Where(x => names.ContainsKey(x.DiagnosisId!.Value))
            .GroupBy(x => (PlanId: x.Plan.Id, DiagnosisId: x.DiagnosisId!.Value))
            .Select(g => (
                FirstLine: g.Min(x => x.Line.SortOrder),
                Source: new PrescriptionDiagnosisSourceDto
                {
                    TreatmentPlanId = g.Key.PlanId,
                    PlanCode = g.First().Plan.Code,
                    PlanCreationTime = g.First().Plan.CreationTime,
                    DiagnosisId = g.Key.DiagnosisId,
                    DiagnosisName = names[g.Key.DiagnosisId],
                    ToothCodes = g.SelectMany(x => x.Line.Teeth.Select(t => t.ToothCode))
                        .Distinct()
                        .Order()
                        .ToList(),
                    Notes = g.Select(x => x.Note)
                        .OfType<string>()
                        .Where(n => n.Length > 0)
                        .Distinct()
                        .ToList()
                }))
            .OrderByDescending(x => x.Source.PlanCreationTime)
            .ThenBy(x => x.FirstLine)
            .Select(x => x.Source)
            .ToList();
    }

    private static void GuardTemplateName(bool saveAsTemplate, string? templateName)
    {
        if (saveAsTemplate && string.IsNullOrWhiteSpace(templateName))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionTemplateNameRequired);
        }
    }

    /// <summary>
    /// "BE:Treatment:SaveRxTemplate": stores the slip's lines and lời dặn as a new entry
    /// of the "BE:Common:RxTemplate" catalog, exactly as the Danh mục screen would
    /// (the lời dặn lives in <c>Description</c> there). A template line still
    /// doses "ngày uống × mỗi lần", so the sessions fold back into it: times =
    /// sessions above zero, amount = their mean, and the daily total survives.
    /// </summary>
    private async Task SaveTemplateAsync(Prescription prescription, string templateName)
    {
        var taxonomy = await AsyncExecuter.FirstOrDefaultAsync(
            (await _taxonomyRepository.GetQueryableAsync())
                .Where(t => t.ClinicBranchId == prescription.ClinicBranchId
                            && t.Group == TaxonomyGroups.PrescriptionTemplate)
                .OrderBy(t => t.SortOrder)
                .ThenBy(t => t.CreationTime));

        if (taxonomy == null)
        {
            taxonomy = Taxonomy.Create(
                GuidGenerator.Create(),
                prescription.ClinicBranchId,
                TaxonomyGroups.PrescriptionTemplate,
                DefaultTemplateGroupName);
            await _taxonomyRepository.InsertAsync(taxonomy, autoSave: true);
        }

        var template = CatalogEntry.Create(
            GuidGenerator.Create(),
            prescription.ClinicBranchId,
            taxonomy.Id,
            TaxonomyGroups.PrescriptionTemplate,
            templateName.Trim(),
            description: prescription.Note);

        template.ReplacePrescriptionLines(prescription.Items.Select(item =>
            new PrescriptionTemplateLine(
                GuidGenerator.Create(),
                template.Id,
                item.MedicationId,
                TimesPerDayOf(item),
                Math.Round(item.DailyAmount / TimesPerDayOf(item), 2),
                item.Days,
                item.Usage,
                item.OtherUsage,
                item.SortOrder)));

        await _catalogRepository.InsertAsync(template, autoSave: true);
    }

    private static int TimesPerDayOf(PrescriptionItem item) =>
        new[] { item.Morning, item.Noon, item.Afternoon, item.Evening }.Count(amount => amount > 0m);

    /// <summary>
    /// "DT26-0001": two-digit year and a per-branch, per-year sequence. Two
    /// slips saved in the same instant can share a number; the index on Code is
    /// not unique, so nothing breaks — the number is a label, not a key.
    /// </summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var count = await _repository.CountAsync(x =>
            x.ClinicBranchId == clinicBranchId && x.CreationTime.Year == year);

        return $"DT{year % 100:D2}-{count + 1:D4}";
    }

    private async Task<PrescriptionDto> MapAsync(Prescription prescription)
    {
        return (await MapManyAsync([prescription]))[0];
    }

    private async Task<List<PrescriptionDto>> MapManyAsync(IReadOnlyList<Prescription> prescriptions)
    {
        var staffIds = prescriptions.Select(p => p.StaffId).Distinct().ToList();
        var staffNames = staffIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _userRepository.GetListByIdsAsync(staffIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return prescriptions.Select(p => new PrescriptionDto
        {
            Id = p.Id,
            PatientId = p.PatientId,
            ClinicBranchId = p.ClinicBranchId,
            Code = p.Code,
            StaffId = p.StaffId,
            StaffName = staffNames.GetValueOrDefault(p.StaffId),
            DiagnosisText = p.DiagnosisText,
            DiagnosisNote = p.DiagnosisNote,
            Note = p.Note,
            TreatmentType = p.TreatmentType,
            FollowUpDate = p.FollowUpDate,
            IssuedAt = p.IssuedAt,
            CreationTime = p.CreationTime,
            CreatorId = p.CreatorId,
            LastModificationTime = p.LastModificationTime,
            LastModifierId = p.LastModifierId,
            IsDeleted = p.IsDeleted,
            DeletionTime = p.DeletionTime,
            DeleterId = p.DeleterId,
            Diagnoses = p.Diagnoses
                .OrderBy(d => d.SortOrder)
                .Select(d => new PrescriptionDiagnosisDto
                {
                    TreatmentPlanId = d.TreatmentPlanId,
                    DiagnosisId = d.DiagnosisId,
                    PlanCode = d.PlanCode,
                    DiagnosisName = d.DiagnosisName,
                    ToothCodes = d.ToothCodeList().ToList(),
                    SortOrder = d.SortOrder
                })
                .ToList(),
            Items = p.Items
                .OrderBy(i => i.SortOrder)
                .Select(i => new PrescriptionItemDto
                {
                    Id = i.Id,
                    MedicationId = i.MedicationId,
                    MedicationName = i.MedicationName,
                    Morning = i.Morning,
                    Noon = i.Noon,
                    Afternoon = i.Afternoon,
                    Evening = i.Evening,
                    Days = i.Days,
                    Quantity = i.Quantity,
                    Usage = i.Usage,
                    OtherUsage = i.OtherUsage,
                    SortOrder = i.SortOrder
                })
                .ToList()
        }).ToList();
    }
}
