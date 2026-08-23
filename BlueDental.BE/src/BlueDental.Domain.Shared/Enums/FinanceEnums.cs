namespace BlueDental.Finance;

/// <summary>
/// Direction of a cash voucher — reference: <c>/api/v1/sales?type=income|expense</c>
/// (UI sub-tabs "Thu nhập" / "Chi phí").
/// </summary>
public enum SalesEntryType
{
    Income = 1,
    Expense = 2
}

/// <summary>
/// How money moved. Derived from the reference finance rollup
/// (<c>byCash</c>, <c>byBanking</c>, <c>byCard</c>, <c>byOutstandingDebt</c>).
/// </summary>
public enum PaymentChannel
{
    /// <summary>Tiền mặt.</summary>
    Cash = 1,

    /// <summary>Chuyển khoản.</summary>
    Banking = 2,

    /// <summary>Quẹt thẻ.</summary>
    Card = 3,

    /// <summary>Cấn trừ vào dư nợ của khách.</summary>
    OutstandingDebt = 4
}

/// <summary>
/// Approval state of a cash voucher. Only expenses require approval in the
/// reference (permission <c>reportCost.approve</c>).
/// </summary>
public enum SalesApprovalStatus
{
    /// <summary>Không cần duyệt (phiếu thu).</summary>
    NotRequired = 0,

    /// <summary>Chờ duyệt.</summary>
    Pending = 1,

    /// <summary>Đã duyệt.</summary>
    Approved = 2,

    /// <summary>Từ chối.</summary>
    Rejected = 3
}

/// <summary>
/// Cash-management transaction kinds — reference actions on
/// "Luân chuyển dòng tiền V2": Nạp / Rút / Luân chuyển.
/// </summary>
public enum CashTransactionType
{
    /// <summary>Nạp.</summary>
    Deposit = 1,

    /// <summary>Rút.</summary>
    Withdraw = 2,

    /// <summary>Luân chuyển giữa hai hình thức nắm giữ.</summary>
    Transfer = 3
}

/// <summary>Where the clinic's money is held.</summary>
public enum CashHolding
{
    /// <summary>Tổng Tiền Mặt.</summary>
    Cash = 1,

    /// <summary>Tổng Chuyển Khoản.</summary>
    Bank = 2,

    /// <summary>Đang Giữ Hộ Khách — customer prepaid held by the clinic.</summary>
    CustomerPrepaid = 3
}
