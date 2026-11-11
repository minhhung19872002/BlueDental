namespace BlueDental.Labo;

/// <summary>
/// One block of the Phiếu yêu cầu as a Mẫu phiếu lays it out (F-94). The
/// system blocks are the slip's fixed parts: a template may move, rename,
/// resize and — save Thông tin phiếu and Chỉ định — hide them, never remove
/// or repeat them. <see cref="Custom"/> is a section of the template's own fields.
/// </summary>
public enum LaboFormBlockKind : short
{
    /// <summary>A section of the template's own fields.</summary>
    Custom = 0,

    /// <summary>Thông tin phiếu: Mã số, Loại ca, Bác sĩ, Ngày gửi, Ngày nhận. Always shown.</summary>
    Info = 1,

    /// <summary>Loại phục hình (the material groups).</summary>
    Restoration = 2,

    /// <summary>Màu răng by zone.</summary>
    Shade = 3,

    /// <summary>Chỉ định: the tooth chart. Always shown.</summary>
    Teeth = 4,

    /// <summary>Đường hoàn tất.</summary>
    FinishLine = 5,

    /// <summary>Yêu cầu: the note and the pictures.</summary>
    Notes = 6
}
