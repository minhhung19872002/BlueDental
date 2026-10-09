namespace BlueDental.PatientManagement;

/// <summary>
/// "Mối quan hệ" between two patient records (function list 4.8). BlueDental-local;
/// see docs/clone/pages/patient-relations.md.
///
/// A value always says what the <em>other</em> record is to the one being read:
/// on the child's record the father is <see cref="Parent"/>, on the father's the
/// child is <see cref="Child"/>. The screen words it by gender (Bố / Mẹ, Vợ / Chồng).
/// </summary>
public enum PatientRelationType : short
{
    Spouse = 1,
    Parent = 2,
    Child = 3,
    Sibling = 4,
    Grandparent = 5,
    Grandchild = 6,
    /// <summary>Họ hàng — cô / dì / chú / bác / anh chị em họ.</summary>
    Relative = 7,
    Friend = 8,
    Colleague = 9,
    Other = 10,
}

/// <summary>"Hồ sơ nhóm" (function list 4.10): a family, or any other group of records.</summary>
public enum PatientGroupKind : short
{
    /// <summary>Gia đình — a patient belongs to one family group at most.</summary>
    Family = 1,

    /// <summary>Nhóm khác — a company, a school class, a sports team…</summary>
    Other = 2,
}

public enum PatientGroupRole : short
{
    /// <summary>Chủ hộ (family) / Trưởng nhóm — at most one per group.</summary>
    Head = 1,
    Member = 2,
}

public static class PatientRelationTypes
{
    /// <summary>What the first record is to the second, given what the second is to the first.</summary>
    public static PatientRelationType Inverse(PatientRelationType type) => type switch
    {
        PatientRelationType.Parent => PatientRelationType.Child,
        PatientRelationType.Child => PatientRelationType.Parent,
        PatientRelationType.Grandparent => PatientRelationType.Grandchild,
        PatientRelationType.Grandchild => PatientRelationType.Grandparent,
        _ => type,
    };

    /// <summary>Người nhà — the relations a family prepaid card can be shared along.</summary>
    public static bool IsFamily(PatientRelationType type) =>
        type is not (PatientRelationType.Friend or PatientRelationType.Colleague or PatientRelationType.Other);

    public static bool IsDefined(PatientRelationType type) =>
        type is >= PatientRelationType.Spouse and <= PatientRelationType.Other;
}

public static class PatientRelationConsts
{
    public const int MaxNoteLength = 200;
    public const int MaxGroupNameLength = 150;
    public const int MaxGroupNoteLength = 500;
    public const int MaxSharedMedicalNoteLength = 2000;
    public const int MaxGroupMembers = 30;
}
