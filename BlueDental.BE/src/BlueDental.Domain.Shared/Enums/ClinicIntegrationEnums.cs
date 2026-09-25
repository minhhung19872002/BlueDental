namespace BlueDental.ClinicIntegration;

/// <summary>
/// Where a branch's link to the partner system stands. The reference's flags
/// payload carries <c>status: "active"</c>; the other values are BlueDental's
/// (UNKNOWN_REFERENCE_BEHAVIOR — docs/clone/unknowns.md).
/// </summary>
public enum ClinicConnectionStatus
{
    /// <summary>Credentials saved, never confirmed by a handshake.</summary>
    Pending = 0,

    /// <summary>The last handshake succeeded.</summary>
    Active = 1,

    /// <summary>The last handshake was refused or could not reach the partner.</summary>
    Failed = 2
}

/// <summary>What the partner did with one service of a batch.</summary>
public enum PartnerServiceStatus
{
    Created = 0,
    Updated = 1,

    /// <summary>The partner already holds that code on a different record.</summary>
    Duplicated = 2,

    /// <summary>Accepted, with a remark the clinic should read.</summary>
    Warned = 3,

    Failed = 4
}
