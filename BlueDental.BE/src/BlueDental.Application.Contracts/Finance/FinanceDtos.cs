using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Finance;

public class SalesEntryDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public SalesEntryType Type { get; set; }
    public Guid CategoryId { get; set; }
    public Guid? PatientId { get; set; }
    public Guid StaffId { get; set; }
    public decimal Amount { get; set; }
    public PaymentChannel Channel { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateOnly EntryDate { get; set; }
    public SalesApprovalStatus ApprovalStatus { get; set; }
    public Guid? ApprovedByStaffId { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    public bool CountsTowardsCashflow { get; set; }

    public string? CategoryName { get; set; }
    public string? StaffName { get; set; }
    public string? PatientName { get; set; }
}

public class CreateSalesEntryDto
{
    public Guid ClinicBranchId { get; set; }
    public SalesEntryType Type { get; set; }
    public Guid CategoryId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? PatientId { get; set; }
    public decimal Amount { get; set; }
    public PaymentChannel Channel { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateOnly EntryDate { get; set; }
}

public class UpdateSalesEntryDto
{
    public Guid CategoryId { get; set; }
    public Guid? PatientId { get; set; }
    public decimal Amount { get; set; }
    public PaymentChannel Channel { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateOnly EntryDate { get; set; }
}

public class GetSalesEntryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public SalesEntryType? Type { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? StaffId { get; set; }
    public PaymentChannel? Channel { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    /// <summary>Mirrors the reference <c>approved=true|false</c> filter.</summary>
    public bool? Approved { get; set; }
}

public class RejectSalesEntryInput
{
    public Guid StaffId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class ApproveSalesEntryInput
{
    public Guid StaffId { get; set; }
}

/// <summary>Footer panel "Thông tin thu chi" of the cashflow report tab.</summary>
public class SalesStatsDto
{
    public decimal TotalIncome { get; set; }
    public decimal TotalExpense { get; set; }

    /// <summary>Income minus approved expenses.</summary>
    public decimal Net { get; set; }

    public decimal PendingExpense { get; set; }
    public int PendingExpenseCount { get; set; }

    public decimal IncomeByCash { get; set; }
    public decimal IncomeByBanking { get; set; }
    public decimal ExpenseByCash { get; set; }
    public decimal ExpenseByBanking { get; set; }
}

public class CashflowCategoryDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public SalesEntryType Type { get; set; }
    public bool AppliesToTransfers { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public string? Description { get; set; }
}

public class CreateCashflowCategoryDto
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public SalesEntryType Type { get; set; }
    public bool AppliesToTransfers { get; set; }
    public int SortOrder { get; set; }
    public string? Description { get; set; }
}

public class UpdateCashflowCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class GetCashflowCategoryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public SalesEntryType? Type { get; set; }
    public bool? AppliesToTransfers { get; set; }
    public bool? IsActive { get; set; }
}

public class CashflowEntryDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public CashTransactionType TransactionType { get; set; }
    public CashHolding? FromHolding { get; set; }
    public CashHolding? ToHolding { get; set; }
    public decimal Amount { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid CreatedByStaffId { get; set; }
    public DateOnly EntryDate { get; set; }
    public string? Note { get; set; }

    public string? CategoryName { get; set; }
    public string? CreatedByStaffName { get; set; }
}

public class CreateCashflowEntryDto
{
    public Guid ClinicBranchId { get; set; }
    public CashTransactionType TransactionType { get; set; }
    public CashHolding? FromHolding { get; set; }
    public CashHolding? ToHolding { get; set; }
    public decimal Amount { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid CreatedByStaffId { get; set; }
    public DateOnly EntryDate { get; set; }
    public string? Note { get; set; }
}

public class GetCashflowEntryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public CashTransactionType? TransactionType { get; set; }
    public CashHolding? Holding { get; set; }
    public Guid? CategoryId { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }
}

/// <summary>Summary panels of "Luân chuyển dòng tiền V2".</summary>
public class CashBalanceDto
{
    /// <summary>Tổng Tiền.</summary>
    public decimal Total { get; set; }

    /// <summary>Tổng Tiền Mặt.</summary>
    public decimal Cash { get; set; }

    /// <summary>Tổng Chuyển Khoản.</summary>
    public decimal Bank { get; set; }

    /// <summary>Đang Giữ Hộ Khách.</summary>
    public decimal CustomerPrepaid { get; set; }
}

public class CashflowOverviewDto
{
    public CashBalanceDto Balance { get; set; } = new();
    public decimal TotalDeposit { get; set; }
    public decimal TotalWithdraw { get; set; }
    public decimal TotalTransfer { get; set; }
    public int EntryCount { get; set; }
    public List<CashflowCategoryTotalDto> ByCategory { get; set; } = new();
}

public class CashflowCategoryTotalDto
{
    public Guid? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public decimal Amount { get; set; }
    public int EntryCount { get; set; }
}
