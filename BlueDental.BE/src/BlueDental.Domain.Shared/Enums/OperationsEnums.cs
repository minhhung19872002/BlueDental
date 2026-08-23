namespace BlueDental.Operations;

/// <summary>
/// The eight departments of "Quản trị vận hành". Taken from the reference's own
/// ability subject naming (<c>operations&lt;Department&gt;&lt;Section&gt;</c>).
/// </summary>
public enum OperationsDepartment : short
{
    /// <summary>Quản trị vận hành (tổng quan).</summary>
    Overview = 1,

    /// <summary>Khối trợ lý.</summary>
    Assistant = 2,

    /// <summary>Khối lễ tân.</summary>
    Reception = 3,

    /// <summary>Khối CSKH.</summary>
    Cskh = 4,

    /// <summary>Khối Marketing.</summary>
    Marketing = 5,

    /// <summary>Khối bảo vệ.</summary>
    Security = 6,

    /// <summary>Khối điều trị.</summary>
    Treatment = 7,

    /// <summary>Khối tài chính.</summary>
    Finance = 8
}

/// <summary>
/// The writable sections of a department. The reference's read-only sections
/// (Báo cáo, Truy cập, Hóa đơn...) are views over other modules, not content, so
/// they are not stored here.
/// </summary>
public enum OperationsSection : short
{
    /// <summary>Trang chủ — announcements.</summary>
    Home = 1,

    /// <summary>Quy trình — standard operating procedures.</summary>
    Process = 2
}

/// <summary>Lifecycle of a "Công việc" item.</summary>
public enum OperationsTaskStatus : short
{
    Todo = 1,
    InProgress = 2,
    Done = 3,
    Cancelled = 4
}
