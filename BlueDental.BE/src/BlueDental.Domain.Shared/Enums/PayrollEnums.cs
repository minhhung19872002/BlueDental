namespace BlueDental.Staff;

/// <summary>
/// Where a monthly Bảng lương stands (Cụm 11 mục 5). BlueDental-local: the
/// reference has no payroll (docs/clone/pages/payroll.md).
/// </summary>
public enum PayrollStatus : short
{
    /// <summary>Nháp — recalculated from chấm công, công đoạn and chế tài on demand; rows editable.</summary>
    Draft = 1,

    /// <summary>Đã chốt — frozen: nothing recalculates or edits it any more.</summary>
    Finalized = 2,
}
