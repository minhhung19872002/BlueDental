namespace BlueDental.Staff;

/// <summary>
/// The three levels of Nhân sự → Sơ đồ tổ chức (BA 2026-10-10). BlueDental-local:
/// the reference has no org chart (docs/clone/pages/org-chart.md).
/// </summary>
public enum OrgUnitKind : short
{
    /// <summary>BlueDental — the one top node, headed by the Tổng giám đốc. Never deleted.</summary>
    Root = 1,

    /// <summary>Phòng ban — sits directly under the root only.</summary>
    Department = 2,

    /// <summary>Team bác sĩ — under a Phòng ban or under the root.</summary>
    DoctorTeam = 3,
}

/// <summary>What one line of Lịch sử thay đổi recorded.</summary>
public enum OrgChartAction : short
{
    Created = 1,
    Updated = 2,
    Deleted = 3,
    HeadChanged = 4,
    MembersAssigned = 5,
}

public static class OrgUnitConsts
{
    public const int MaxNameLength = 200;
    public const int MaxCodeLength = 32;
}
