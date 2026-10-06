namespace BlueDental.Staff;

/// <summary>
/// Where a Chế tài nhân viên record stands. BlueDental-local: the reference has
/// no staff-penalty screen (docs/clone/pages/staff-penalty.md).
///
/// Only an approved record counts — it is the one a future payroll deducts.
/// </summary>
public enum StaffPenaltyStatus : short
{
    /// <summary>Nháp — still editable and deletable.</summary>
    Draft = 1,

    /// <summary>Đã duyệt — locked; can only be cancelled, with a reason.</summary>
    Approved = 2,

    /// <summary>Đã huỷ — kept for the record, counts for nothing.</summary>
    Cancelled = 3
}

/// <summary>Hình thức xử lý.</summary>
public enum StaffPenaltyAction : short
{
    /// <summary>Nhắc nhở.</summary>
    Reminder = 1,

    /// <summary>Cảnh cáo.</summary>
    Warning = 2,

    /// <summary>Phạt tiền — the only action that carries an amount.</summary>
    Fine = 3,

    /// <summary>Khác.</summary>
    Other = 4
}
