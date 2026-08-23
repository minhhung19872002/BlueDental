using System;
using BlueDental.Finance;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Finance;

public class SalesEntryTests
{
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _categoryId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();
    private readonly DateOnly _date = new(2026, 8, 20);

    private SalesEntry Record(SalesEntryType type, decimal amount = 1_000_000m) =>
        SalesEntry.Record(
            Guid.NewGuid(), _branchId, "PT26-0001", type, _categoryId, _staffId,
            amount, PaymentChannel.Cash, "Thu tiền dịch vụ", _date);

    [Fact]
    public void Receipt_Should_Not_Require_Approval()
    {
        var entry = Record(SalesEntryType.Income);

        Assert.Equal(SalesApprovalStatus.NotRequired, entry.ApprovalStatus);
        Assert.True(entry.CountsTowardsCashflow);
        Assert.Equal(1_000_000m, entry.SignedAmount);
    }

    [Fact]
    public void Expense_Should_Start_Pending_And_Not_Count_Until_Approved()
    {
        var entry = Record(SalesEntryType.Expense);

        Assert.Equal(SalesApprovalStatus.Pending, entry.ApprovalStatus);
        Assert.False(entry.CountsTowardsCashflow);
        Assert.Equal(0m, entry.SignedAmount);

        entry.Approve(Guid.NewGuid());

        Assert.Equal(SalesApprovalStatus.Approved, entry.ApprovalStatus);
        Assert.True(entry.CountsTowardsCashflow);
        Assert.Equal(-1_000_000m, entry.SignedAmount);
    }

    [Fact]
    public void Should_Reject_Non_Positive_Amounts()
    {
        Assert.Throws<BusinessException>(() => Record(SalesEntryType.Income, 0m));
        Assert.Throws<BusinessException>(() => Record(SalesEntryType.Income, -1m));
    }

    [Fact]
    public void Should_Not_Approve_A_Receipt()
    {
        var entry = Record(SalesEntryType.Income);

        Assert.Throws<BusinessException>(() => entry.Approve(Guid.NewGuid()));
    }

    [Fact]
    public void Should_Reject_Expense_With_A_Reason()
    {
        var entry = Record(SalesEntryType.Expense);
        var approverId = Guid.NewGuid();

        entry.Reject(approverId, "Thiếu chứng từ");

        Assert.Equal(SalesApprovalStatus.Rejected, entry.ApprovalStatus);
        Assert.Equal("Thiếu chứng từ", entry.RejectionReason);
        Assert.False(entry.CountsTowardsCashflow);
    }

    [Fact]
    public void Should_Not_Reject_An_Approved_Expense()
    {
        var entry = Record(SalesEntryType.Expense);
        entry.Approve(Guid.NewGuid());

        Assert.Throws<BusinessException>(() => entry.Reject(Guid.NewGuid(), "x"));
    }

    [Fact]
    public void Should_Lock_An_Approved_Expense_From_Edits()
    {
        var entry = Record(SalesEntryType.Expense);
        entry.Approve(Guid.NewGuid());

        Assert.Throws<BusinessException>(() => entry.UpdateDetails(
            _categoryId, 500_000m, PaymentChannel.Banking, "Sửa", _date, null));
    }

    [Fact]
    public void Rejected_Expense_Should_Still_Be_Editable_And_Re_Approvable()
    {
        var entry = Record(SalesEntryType.Expense);
        entry.Reject(Guid.NewGuid(), "Thiếu chứng từ");

        entry.UpdateDetails(_categoryId, 800_000m, PaymentChannel.Banking, "Bổ sung chứng từ", _date, null);
        entry.Approve(Guid.NewGuid());

        Assert.Equal(SalesApprovalStatus.Approved, entry.ApprovalStatus);
        Assert.Null(entry.RejectionReason);
        Assert.Equal(-800_000m, entry.SignedAmount);
    }
}

public class CashflowEntryTests
{
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();
    private readonly DateOnly _date = new(2026, 8, 20);

    [Fact]
    public void Deposit_Should_Only_Credit_The_Target_Holding()
    {
        var entry = CashflowEntry.Deposit(
            Guid.NewGuid(), _branchId, CashHolding.Cash, 5_000_000m, _staffId, _date);

        Assert.Equal(5_000_000m, entry.EffectOn(CashHolding.Cash));
        Assert.Equal(0m, entry.EffectOn(CashHolding.Bank));
        Assert.Null(entry.FromHolding);
    }

    [Fact]
    public void Withdraw_Should_Only_Debit_The_Source_Holding()
    {
        var entry = CashflowEntry.Withdraw(
            Guid.NewGuid(), _branchId, CashHolding.Bank, 2_000_000m, _staffId, _date);

        Assert.Equal(-2_000_000m, entry.EffectOn(CashHolding.Bank));
        Assert.Equal(0m, entry.EffectOn(CashHolding.Cash));
        Assert.Null(entry.ToHolding);
    }

    [Fact]
    public void Transfer_Should_Move_Between_Two_Holdings()
    {
        var entry = CashflowEntry.Transfer(
            Guid.NewGuid(), _branchId, CashHolding.Cash, CashHolding.Bank,
            3_000_000m, _staffId, _date);

        Assert.Equal(-3_000_000m, entry.EffectOn(CashHolding.Cash));
        Assert.Equal(3_000_000m, entry.EffectOn(CashHolding.Bank));
    }

    [Fact]
    public void Transfer_Should_Reject_The_Same_Holding_On_Both_Sides()
    {
        Assert.Throws<BusinessException>(() => CashflowEntry.Transfer(
            Guid.NewGuid(), _branchId, CashHolding.Cash, CashHolding.Cash,
            1_000_000m, _staffId, _date));
    }

    [Fact]
    public void Should_Reject_Non_Positive_Amounts()
    {
        Assert.Throws<BusinessException>(() => CashflowEntry.Deposit(
            Guid.NewGuid(), _branchId, CashHolding.Cash, 0m, _staffId, _date));
        Assert.Throws<BusinessException>(() => CashflowEntry.Withdraw(
            Guid.NewGuid(), _branchId, CashHolding.Cash, -5m, _staffId, _date));
    }
}

public class CashflowCategoryTests
{
    private readonly Guid _branchId = Guid.NewGuid();

    [Fact]
    public void Should_Create_An_Active_Category()
    {
        var category = CashflowCategory.Create(
            Guid.NewGuid(), _branchId, "Tiền điện", SalesEntryType.Expense);

        Assert.True(category.IsActive);
        Assert.False(category.IsSystem);
        Assert.False(category.AppliesToTransfers);
    }

    [Fact]
    public void Should_Not_Modify_A_System_Category()
    {
        var category = CashflowCategory.Create(
            Guid.NewGuid(), _branchId, "Doanh thu dịch vụ", SalesEntryType.Income, isSystem: true);

        Assert.Throws<BusinessException>(() => category.Rename("Khác"));
        Assert.Throws<BusinessException>(() => category.Deactivate());
    }
}
