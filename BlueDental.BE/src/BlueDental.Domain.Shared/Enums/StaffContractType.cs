namespace BlueDental.Staff;

/// <summary>
/// "Loại hợp đồng" on the staff profile (Cụm 11 mục 1). BlueDental-local: the
/// reference has no such field (docs/clone/pages/staff-employment.md).
/// </summary>
public enum StaffContractType : short
{
    /// <summary>Thử việc.</summary>
    Probation = 1,

    /// <summary>Có thời hạn.</summary>
    FixedTerm = 2,

    /// <summary>Không thời hạn.</summary>
    Indefinite = 3,

    /// <summary>Thời vụ / cộng tác viên.</summary>
    Seasonal = 4,
}
