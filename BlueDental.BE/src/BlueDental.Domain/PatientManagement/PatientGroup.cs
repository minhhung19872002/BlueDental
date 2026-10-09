using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Hồ sơ nhóm" (function list 4.10): records looked after together — a family
/// with a shared medical background, or any other group — so a dentist can
/// read every member's record from one place. BlueDental-local; see
/// docs/clone/pages/patient-relations.md.
///
/// A patient belongs to one <see cref="PatientGroupKind.Family"/> group at
/// most; the app service checks that across groups.
/// </summary>
public class PatientGroup : FullAuditedAggregateRoot<Guid>
{
    private readonly List<PatientGroupMember> _members = new();

    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public PatientGroupKind Kind { get; private set; }
    public string? Note { get; private set; }

    /// <summary>"Thông tin y khoa chung" — tiền sử gia đình, bệnh di truyền, lưu ý chung.</summary>
    public string? SharedMedicalNote { get; private set; }

    public IReadOnlyCollection<PatientGroupMember> Members => _members.AsReadOnly();

    protected PatientGroup() { }

    public PatientGroup(Guid id, Guid clinicBranchId) : base(id)
    {
        ClinicBranchId = clinicBranchId;
    }

    public PatientGroup Update(PatientGroupKind kind, string name, string? note, string? sharedMedicalNote)
    {
        if (kind is not (PatientGroupKind.Family or PatientGroupKind.Other))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
        }

        Kind = kind;
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), PatientRelationConsts.MaxGroupNameLength).Trim();
        Note = Trim(note, PatientRelationConsts.MaxGroupNoteLength);
        SharedMedicalNote = Trim(sharedMedicalNote, PatientRelationConsts.MaxSharedMedicalNoteLength);
        return this;
    }

    /// <summary>Replaces the members, in the order given; one Chủ hộ / Trưởng nhóm at most.</summary>
    public PatientGroup SetMembers(IReadOnlyList<(Guid PatientId, PatientGroupRole Role)> members, Func<Guid> newId)
    {
        if (members.Count == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.GroupNeedsMember);
        }

        if (members.Count > PatientRelationConsts.MaxGroupMembers)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.TooManyMembers)
                .WithData("Max", PatientRelationConsts.MaxGroupMembers);
        }

        if (members.Select(m => m.PatientId).Distinct().Count() != members.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.DuplicateMember);
        }

        if (members.Any(m => m.Role is not (PatientGroupRole.Head or PatientGroupRole.Member)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
        }

        if (members.Count(m => m.Role == PatientGroupRole.Head) > 1)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.OneHead);
        }

        _members.Clear();
        for (var i = 0; i < members.Count; i++)
        {
            _members.Add(new PatientGroupMember(newId(), members[i].PatientId, members[i].Role, i + 1));
        }

        return this;
    }

    public PatientGroupMember? Head => _members.FirstOrDefault(m => m.Role == PatientGroupRole.Head);

    public bool Has(Guid patientId) => _members.Any(m => m.PatientId == patientId);

    private static string? Trim(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : Check.Length(value.Trim(), nameof(value), max);
}

/// <summary>One record of a <see cref="PatientGroup"/>.</summary>
public class PatientGroupMember : Entity<Guid>
{
    /// <summary>Set by EF from the group's collection.</summary>
    public Guid PatientGroupId { get; private set; }

    public Guid PatientId { get; private set; }
    public PatientGroupRole Role { get; private set; }
    public int SortOrder { get; private set; }

    protected PatientGroupMember() { }

    internal PatientGroupMember(Guid id, Guid patientId, PatientGroupRole role, int sortOrder) : base(id)
    {
        PatientId = patientId;
        Role = role;
        SortOrder = sortOrder;
    }
}
