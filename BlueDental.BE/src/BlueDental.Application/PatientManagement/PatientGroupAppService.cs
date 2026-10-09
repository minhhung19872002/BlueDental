using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Hồ sơ nhóm" (/patient-group, function list 4.10). BlueDental-local; see
/// docs/clone/pages/patient-relations.md. Groups live in one branch, like the
/// records they gather.
/// </summary>
[Authorize]
public class PatientGroupAppService(
    IRepository<PatientGroup, Guid> repository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<PatientRelationship, Guid> relationshipRepository,
    IRepository<TreatmentPlan, Guid> planRepository,
    IRepository<PatientPayment, Guid> paymentRepository,
    IRepository<Appointment, Guid> appointmentRepository,
    IRepository<CatalogEntry, Guid> catalogRepository,
    PatientListRollupCalculator rollup,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IPatientGroupAppService
{
    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Read)]
    public async Task<PagedResultDto<PatientGroupDto>> GetListAsync(GetPatientGroupListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var query = (await repository.WithDetailsAsync(g => g.Members)).Where(g => g.ClinicBranchId == branchId);
        if (input.Kind.HasValue) query = query.Where(g => g.Kind == input.Kind.Value);

        foreach (var term in SearchTerms.From(input.Filter))
        {
            var patients = await patientRepository.GetQueryableAsync();
            var matching = patients
                .Where(p => p.BranchId == branchId
                            && (p.PatientCode.ToLower().Contains(term) || p.FirstName.ToLower().Contains(term)
                                || p.LastName.ToLower().Contains(term)))
                .Select(p => p.Id);
            query = query.Where(g => g.Name.ToLower().Contains(term) || g.Members.Any(m => matching.Contains(m.PatientId)));
        }

        var total = await AsyncExecuter.CountAsync(query);
        var groups = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(g => g.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        var names = await PatientsAsync(groups.SelectMany(g => g.Members).Select(m => m.PatientId));
        return new PagedResultDto<PatientGroupDto>(total, groups.Select(g => Fill(new PatientGroupDto(), g, names)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Read)]
    public async Task<PatientGroupDetailDto> GetAsync(Guid id) => (await DetailAsync([await LoadAsync(id)])).Single();

    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Read)]
    public async Task<ListResultDto<PatientGroupDetailDto>> GetByPatientAsync(Guid patientId)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var groups = await AsyncExecuter.ToListAsync((await repository.WithDetailsAsync(g => g.Members))
            .Where(g => g.ClinicBranchId == branchId && g.Members.Any(m => m.PatientId == patientId))
            .OrderBy(g => g.Kind)
            .ThenBy(g => g.Name));
        return new ListResultDto<PatientGroupDetailDto>(await DetailAsync(groups));
    }

    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Create)]
    public async Task<PatientGroupDetailDto> CreateAsync(SavePatientGroupDto input)
    {
        var group = new PatientGroup(GuidGenerator.Create(), branchResolver.GetRequiredClinicBranchId());
        await ApplyAsync(group, input);
        await repository.InsertAsync(group, autoSave: true);
        return (await DetailAsync([group])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Update)]
    public async Task<PatientGroupDetailDto> UpdateAsync(Guid id, SavePatientGroupDto input)
    {
        var group = await LoadAsync(id);
        await ApplyAsync(group, input);
        await repository.UpdateAsync(group, autoSave: true);
        return (await DetailAsync([group])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.PatientGroup.Delete)]
    public async Task DeleteAsync(Guid id) => await repository.DeleteAsync(await LoadAsync(id), autoSave: true);

    /// <summary>
    /// Members must be records of the branch, and a record sits in one family
    /// group at most — "gia đình của tôi" has to be one answer.
    /// </summary>
    private async Task ApplyAsync(PatientGroup group, SavePatientGroupDto input)
    {
        group.Update(input.Kind, input.Name, input.Note, input.SharedMedicalNote);
        group.SetMembers(input.Members.Select(m => (m.PatientId, m.Role)).ToList(), GuidGenerator.Create);

        var ids = group.Members.Select(m => m.PatientId).ToList();
        var known = await patientRepository.CountAsync(p => ids.Contains(p.Id) && p.BranchId == group.ClinicBranchId);
        if (known != ids.Count)
        {
            throw new EntityNotFoundException(typeof(Patient));
        }

        if (group.Kind != PatientGroupKind.Family)
        {
            return;
        }

        var others = await AsyncExecuter.ToListAsync((await repository.WithDetailsAsync(g => g.Members))
            .Where(g => g.Id != group.Id && g.Kind == PatientGroupKind.Family && g.ClinicBranchId == group.ClinicBranchId)
            .Where(g => g.Members.Any(m => ids.Contains(m.PatientId))));
        if (others.Count > 0)
        {
            var clash = others[0];
            var patientId = clash.Members.First(m => ids.Contains(m.PatientId)).PatientId;
            var patient = await patientRepository.GetAsync(patientId);
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.AlreadyInFamily)
                .WithData("Name", patient.FullName)
                .WithData("Group", clash.Name);
        }
    }

    private async Task<PatientGroup> LoadAsync(Guid id)
    {
        var group = await AsyncExecuter.FirstOrDefaultAsync((await repository.WithDetailsAsync(g => g.Members))
            .Where(g => g.Id == id));
        if (group is null || group.ClinicBranchId != branchResolver.GetRequiredClinicBranchId())
        {
            throw new EntityNotFoundException(typeof(PatientGroup), id);
        }

        return group;
    }

    private async Task<Dictionary<Guid, Patient>> PatientsAsync(IEnumerable<Guid> patientIds)
    {
        var ids = patientIds.Distinct().ToList();
        return ids.Count == 0
            ? new Dictionary<Guid, Patient>()
            : (await patientRepository.GetListAsync(p => ids.Contains(p.Id))).ToDictionary(p => p.Id);
    }

    private static T Fill<T>(T dto, PatientGroup g, IReadOnlyDictionary<Guid, Patient> patients) where T : PatientGroupDto
    {
        var ordered = g.Members.OrderBy(m => m.SortOrder).ToList();
        dto.Id = g.Id;
        dto.Name = g.Name;
        dto.Kind = g.Kind;
        dto.Note = g.Note;
        dto.SharedMedicalNote = g.SharedMedicalNote;
        dto.MemberCount = ordered.Count;
        dto.HeadName = g.Head is { } head && patients.TryGetValue(head.PatientId, out var h) ? h.FullName : null;
        dto.MemberNames = ordered
            .Where(m => patients.ContainsKey(m.PatientId))
            .Select(m => patients[m.PatientId].FullName)
            .ToList();
        dto.CreationTime = g.CreationTime;
        return dto;
    }

    /// <summary>
    /// The groups with every member's look-up facts: tiểu sử bệnh, lần khám
    /// gần nhất, lịch hẹn tới, công nợ — the same rollup as the patient list —
    /// and what each member is to the Chủ hộ.
    /// </summary>
    private async Task<List<PatientGroupDetailDto>> DetailAsync(IReadOnlyCollection<PatientGroup> groups)
    {
        var ids = groups.SelectMany(g => g.Members).Select(m => m.PatientId).Distinct().ToList();
        var patients = await PatientsAsync(ids);
        var branchId = branchResolver.GetRequiredClinicBranchId();

        var plans = (await AsyncExecuter.ToListAsync((await planRepository.WithDetailsAsync(p => p.Services))
                .Where(p => p.BranchId == branchId && ids.Contains(p.PatientId))))
            .ToLookup(p => p.PatientId);
        var payments = (await AsyncExecuter.ToListAsync((await paymentRepository.GetQueryableAsync())
                .Where(p => p.ClinicBranchId == branchId && ids.Contains(p.PatientId))))
            .ToLookup(p => p.PatientId);
        var appointments = (await AsyncExecuter.ToListAsync((await appointmentRepository.GetQueryableAsync())
                .Where(a => a.BranchId == branchId && ids.Contains(a.PatientId))))
            .ToLookup(a => a.PatientId);

        var diseaseIds = patients.Values.SelectMany(p => p.DiseaseHistoryEntryIds).Distinct().ToList();
        var diseases = diseaseIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await catalogRepository.GetListAsync(c => diseaseIds.Contains(c.Id))).ToDictionary(c => c.Id, c => c.Name);

        var relations = await AsyncExecuter.ToListAsync((await relationshipRepository.GetQueryableAsync())
            .Where(r => ids.Contains(r.PatientId) && ids.Contains(r.RelatedPatientId)));

        var now = Clock.Now;
        return groups.Select(g =>
        {
            var dto = Fill(new PatientGroupDetailDto(), g, patients);
            var headId = g.Head?.PatientId;
            dto.Members = g.Members
                .OrderBy(m => m.Role)
                .ThenBy(m => m.SortOrder)
                .Where(m => patients.ContainsKey(m.PatientId))
                .Select(m =>
                {
                    var p = patients[m.PatientId];
                    var r = rollup.For(p, plans[p.Id].ToList(), payments[p.Id].ToList(), appointments[p.Id].ToList(), now);
                    var toHead = headId.HasValue && headId != p.Id
                        ? relations.FirstOrDefault(x => x.Involves(headId.Value) && x.Involves(p.Id))
                        : null;
                    return new PatientGroupMemberDto
                    {
                        PatientId = p.Id,
                        PatientCode = p.PatientCode,
                        FullName = p.FullName,
                        Gender = p.Gender,
                        DateOfBirth = p.DateOfBirth,
                        Role = m.Role,
                        RelationToHead = toHead?.TypeSeenFrom(headId!.Value),
                        DiseaseHistory = p.DiseaseHistoryEntryIds
                            .Where(diseases.ContainsKey)
                            .Select(d => diseases[d])
                            .ToList(),
                        LastVisitAt = r.LastVisitAt,
                        NextAppointmentAt = r.NextAppointmentAt,
                        TotalDebt = r.TotalDebt,
                    };
                })
                .ToList();
            return dto;
        }).ToList();
    }
}
