using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Guids;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.PatientManagement;

/// <summary>
/// One record related to a patient: the declared relation when there is one,
/// and whether that person is also a guardian (or ward) or in the same family
/// group. One link per person, however many ways they are tied.
/// </summary>
public sealed record PatientLink(
    Guid OtherPatientId,
    PatientRelationSource Source,
    PatientRelationType? Type,
    bool IsFamily,
    Guid? RelationshipId = null,
    string? Note = null,
    GuardianDirection? GuardianDirection = null,
    GuardianRelation? GuardianRelation = null,
    bool InFamilyGroup = false)
{
    /// <summary>The pair's relation follows a guardian card's kinship pill and is changed there.</summary>
    public bool SetByGuardian =>
        GuardianRelation is { } relation && PatientRelationTypes.KinshipOf(relation).HasValue;
}

/// <summary>
/// Người nhà of a patient record, read and written in one place so the
/// relation list, the guardian cards, Hồ sơ nhóm and the family prepaid card
/// give one answer (owner, 2026-10-12). The declared relation (4.8) is the
/// single store of "what is X to Y":
/// <list type="bullet">
/// <item>a guardian picked from a patient record with a kinship pill (Bố, Mẹ,
/// Ông, Bà, Anh/Chị ruột, Cô/Dì/Chú/Bác) writes it on the hồ sơ's save;</item>
/// <item>a family group writes each member's relation to its Chủ hộ.</item>
/// </list>
/// </summary>
public class PatientFamilyResolver(
    IRepository<PatientRelationship, Guid> relationshipRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<PatientGroup, Guid> groupRepository,
    IAsyncQueryableExecuter asyncExecuter,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    /// <summary>
    /// Declares a relation between two records of one branch, refusing a pair
    /// already related either way round. Used by the relations list and when a
    /// family prepaid card is shared with a record not yet declared as family.
    /// The caller has checked both records and the permission.
    /// </summary>
    public async Task<PatientRelationship> RelateAsync(
        Guid branchId, Guid patientId, Guid relatedPatientId, PatientRelationType type, string? note)
    {
        if (await FindAsync(patientId, relatedPatientId) is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.DuplicateRelation);
        }

        var relationship = new PatientRelationship(
            guidGenerator.Create(), branchId, patientId, relatedPatientId, type, note);
        await relationshipRepository.InsertAsync(relationship, autoSave: true);
        return relationship;
    }

    /// <summary>
    /// Makes <paramref name="otherId"/> be <paramref name="type"/> to
    /// <paramref name="patientId"/>: the pair's relation is changed, or written
    /// when there is none. The note on file is kept.
    /// </summary>
    public async Task SetAsync(Guid branchId, Guid patientId, Guid otherId, PatientRelationType type)
    {
        var existing = await FindAsync(patientId, otherId);
        if (existing is null)
        {
            await RelateAsync(branchId, patientId, otherId, type, null);
            return;
        }

        if (existing.TypeSeenFrom(patientId) != type)
        {
            existing.Change(patientId, type, existing.Note);
            await relationshipRepository.UpdateAsync(existing, autoSave: true);
        }
    }

    /// <summary>
    /// The hồ sơ's guardians picked from a patient record, with a kinship pill,
    /// become the pair's Mối quan hệ — the card is where that relation is
    /// changed. Run after the hồ sơ is saved. A guardian removed from the card
    /// leaves the relation: the person is still family.
    /// </summary>
    public async Task SyncGuardiansAsync(Patient patient)
    {
        foreach (var guardian in patient.Guardians)
        {
            if (guardian.LinkedPatientId is { } linked
                && linked != patient.Id
                && PatientRelationTypes.KinshipOf(guardian.Relation) is { } kinship)
            {
                await SetAsync(patient.BranchId, patient.Id, linked, kinship);
            }
        }
    }

    public async Task<PatientRelationship?> FindAsync(Guid patientId, Guid otherId) =>
        await relationshipRepository.FirstOrDefaultAsync(r =>
            (r.PatientId == patientId && r.RelatedPatientId == otherId)
            || (r.PatientId == otherId && r.RelatedPatientId == patientId));

    /// <summary>Every person tied to the patient, one link each, in the order: relations, guardians, wards, family group.</summary>
    public async Task<List<PatientLink>> LinksOfAsync(Guid patientId)
    {
        var links = new Dictionary<Guid, PatientLink>();

        var relations = await relationshipRepository.GetQueryableAsync();
        foreach (var r in await asyncExecuter.ToListAsync(
                     relations.Where(r => r.PatientId == patientId || r.RelatedPatientId == patientId)))
        {
            var type = r.TypeSeenFrom(patientId);
            links[r.OtherOf(patientId)] = new PatientLink(r.OtherOf(patientId), PatientRelationSource.Relationship,
                type, PatientRelationTypes.IsFamily(type), r.Id, r.Note);
        }

        // Guardians picked from a patient record, both ways. A guardian always counts as family.
        var patients = await patientRepository.WithDetailsAsync(p => p.Guardians);
        var self = await asyncExecuter.FirstOrDefaultAsync(patients.Where(p => p.Id == patientId));
        foreach (var g in self?.Guardians.Where(g => g.LinkedPatientId.HasValue && g.LinkedPatientId != patientId) ?? [])
        {
            AddGuardian(links, g.LinkedPatientId!.Value, GuardianDirection.GuardsPatient, g.Relation,
                PatientRelationTypes.KinshipOf(g.Relation));
        }

        var wards = await asyncExecuter.ToListAsync(
            patients.Where(p => p.Id != patientId && p.Guardians.Any(g => g.LinkedPatientId == patientId)));
        foreach (var ward in wards)
        {
            var relation = ward.Guardians.First(g => g.LinkedPatientId == patientId).Relation;
            var kinship = PatientRelationTypes.KinshipOf(relation);
            AddGuardian(links, ward.Id, GuardianDirection.GuardedByPatient, relation,
                kinship.HasValue ? PatientRelationTypes.Inverse(kinship.Value) : null);
        }

        // Fellow members of the family group.
        var groups = await groupRepository.WithDetailsAsync(g => g.Members);
        var family = await asyncExecuter.FirstOrDefaultAsync(groups.Where(g =>
            g.Kind == PatientGroupKind.Family && g.Members.Any(m => m.PatientId == patientId)));
        foreach (var member in family?.Members.Where(m => m.PatientId != patientId) ?? [])
        {
            links[member.PatientId] = links.TryGetValue(member.PatientId, out var known)
                ? known with { IsFamily = true, InFamilyGroup = true }
                : new PatientLink(member.PatientId, PatientRelationSource.FamilyGroup, null, true, InFamilyGroup: true);
        }

        return links.Values.ToList();
    }

    /// <summary>Người nhà of the patient — who a family prepaid card may be shared with.</summary>
    public async Task<HashSet<Guid>> FamilyOfAsync(Guid patientId) =>
        (await LinksOfAsync(patientId)).Where(l => l.IsFamily).Select(l => l.OtherPatientId).ToHashSet();

    private static void AddGuardian(
        Dictionary<Guid, PatientLink> links, Guid otherId, GuardianDirection direction, GuardianRelation relation,
        PatientRelationType? kinship)
    {
        links[otherId] = links.TryGetValue(otherId, out var known)
            ? known with { IsFamily = true, GuardianDirection = direction, GuardianRelation = relation }
            : new PatientLink(otherId, PatientRelationSource.Guardian, kinship, true,
                GuardianDirection: direction, GuardianRelation: relation);
    }
}
