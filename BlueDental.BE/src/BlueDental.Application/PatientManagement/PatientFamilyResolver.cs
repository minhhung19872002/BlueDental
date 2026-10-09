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

/// <summary>One record related to a patient, wherever the link was written.</summary>
public sealed record PatientLink(
    Guid OtherPatientId,
    PatientRelationSource Source,
    PatientRelationType? Type,
    bool IsFamily,
    Guid? RelationshipId = null,
    string? Note = null,
    GuardianDirection? GuardianDirection = null);

/// <summary>
/// Reads every link of a patient record: declared relations (4.8), guardians
/// picked from a patient record (4.9, read only — that feature owns them) in
/// both directions, and fellow members of the patient's family group (4.10).
/// Shared by the relations tab and the family prepaid card, so both agree on
/// who "người nhà" is.
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
    /// already related either way round. Used by the relations tab and when a
    /// family prepaid card is shared with a record not yet declared as family.
    /// The caller has checked both records and the permission.
    /// </summary>
    public async Task<PatientRelationship> RelateAsync(
        Guid branchId, Guid patientId, Guid relatedPatientId, PatientRelationType type, string? note)
    {
        if (await relationshipRepository.AnyAsync(r =>
                (r.PatientId == patientId && r.RelatedPatientId == relatedPatientId)
                || (r.PatientId == relatedPatientId && r.RelatedPatientId == patientId)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.DuplicateRelation);
        }

        var relationship = new PatientRelationship(
            guidGenerator.Create(), branchId, patientId, relatedPatientId, type, note);
        await relationshipRepository.InsertAsync(relationship, autoSave: true);
        return relationship;
    }

    public async Task<List<PatientLink>> LinksOfAsync(Guid patientId)
    {
        var links = new List<PatientLink>();

        var relations = await relationshipRepository.GetQueryableAsync();
        foreach (var r in await asyncExecuter.ToListAsync(
                     relations.Where(r => r.PatientId == patientId || r.RelatedPatientId == patientId)))
        {
            var type = r.TypeSeenFrom(patientId);
            links.Add(new PatientLink(r.OtherOf(patientId), PatientRelationSource.Relationship, type,
                PatientRelationTypes.IsFamily(type), r.Id, r.Note));
        }

        // Guardians picked from a patient record. A guardian always counts as family.
        var patients = await patientRepository.WithDetailsAsync(p => p.Guardians);
        var self = await asyncExecuter.FirstOrDefaultAsync(patients.Where(p => p.Id == patientId));
        foreach (var g in self?.Guardians.Where(g => g.LinkedPatientId.HasValue) ?? [])
        {
            links.Add(new PatientLink(g.LinkedPatientId!.Value, PatientRelationSource.Guardian,
                FromGuardian(g.Relation), true, GuardianDirection: GuardianDirection.GuardsPatient));
        }

        var wards = await asyncExecuter.ToListAsync(
            patients.Where(p => p.Guardians.Any(g => g.LinkedPatientId == patientId)));
        foreach (var ward in wards)
        {
            var relation = ward.Guardians.First(g => g.LinkedPatientId == patientId).Relation;
            links.Add(new PatientLink(ward.Id, PatientRelationSource.Guardian,
                PatientRelationTypes.Inverse(FromGuardian(relation)), true,
                GuardianDirection: GuardianDirection.GuardedByPatient));
        }

        // Fellow members of the family group, unless already linked above.
        var groups = await groupRepository.WithDetailsAsync(g => g.Members);
        var family = await asyncExecuter.FirstOrDefaultAsync(groups.Where(g =>
            g.Kind == PatientGroupKind.Family && g.Members.Any(m => m.PatientId == patientId)));
        foreach (var member in family?.Members.Where(m => m.PatientId != patientId) ?? [])
        {
            if (links.All(l => l.OtherPatientId != member.PatientId))
            {
                links.Add(new PatientLink(member.PatientId, PatientRelationSource.FamilyGroup, null, true));
            }
        }

        return links;
    }

    /// <summary>Người nhà of the patient — who a family prepaid card may be shared with.</summary>
    public async Task<HashSet<Guid>> FamilyOfAsync(Guid patientId) =>
        (await LinksOfAsync(patientId)).Where(l => l.IsFamily).Select(l => l.OtherPatientId).ToHashSet();

    /// <summary>A guardian's relation, in the relation list's words.</summary>
    public static PatientRelationType FromGuardian(GuardianRelation relation) => relation switch
    {
        GuardianRelation.Father or GuardianRelation.Mother => PatientRelationType.Parent,
        GuardianRelation.Grandfather or GuardianRelation.Grandmother => PatientRelationType.Grandparent,
        GuardianRelation.Sibling => PatientRelationType.Sibling,
        GuardianRelation.AuntUncle => PatientRelationType.Relative,
        _ => PatientRelationType.Other,
    };
}
