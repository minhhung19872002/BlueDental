using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Mối quan hệ" (function list 4.8): two patient records of one branch that
/// belong together — vợ chồng, bố mẹ con, anh chị em… BlueDental-local; see
/// docs/clone/pages/patient-relations.md.
///
/// Written once for the pair: <see cref="Type"/> says what
/// <see cref="RelatedPatientId"/> is to <see cref="PatientId"/>, and the other
/// record reads the inverse (<see cref="TypeSeenFrom"/>).
/// </summary>
public class PatientRelationship : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid RelatedPatientId { get; private set; }
    public PatientRelationType Type { get; private set; }
    public string? Note { get; private set; }

    protected PatientRelationship() { }

    public PatientRelationship(
        Guid id, Guid clinicBranchId, Guid patientId, Guid relatedPatientId, PatientRelationType type, string? note)
        : base(id)
    {
        if (patientId == relatedPatientId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.SelfRelation);
        }

        ClinicBranchId = clinicBranchId;
        PatientId = patientId;
        RelatedPatientId = relatedPatientId;
        Change(patientId, type, note);
    }

    public bool Involves(Guid patientId) => PatientId == patientId || RelatedPatientId == patientId;

    /// <summary>The other record of the pair, read from <paramref name="patientId"/>'s side.</summary>
    public Guid OtherOf(Guid patientId) => patientId == PatientId ? RelatedPatientId : PatientId;

    /// <summary>What the other record is to <paramref name="patientId"/>.</summary>
    public PatientRelationType TypeSeenFrom(Guid patientId) =>
        patientId == PatientId ? Type : PatientRelationTypes.Inverse(Type);

    /// <summary>
    /// Rewrites the relation as it is read from <paramref name="seenFrom"/>'s
    /// record — either side may edit it.
    /// </summary>
    public PatientRelationship Change(Guid seenFrom, PatientRelationType type, string? note)
    {
        if (!PatientRelationTypes.IsDefined(type) || !Involves(seenFrom))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
        }

        Type = seenFrom == PatientId ? type : PatientRelationTypes.Inverse(type);
        Note = string.IsNullOrWhiteSpace(note)
            ? null
            : Check.Length(note.Trim(), nameof(note), PatientRelationConsts.MaxNoteLength);
        return this;
    }
}
