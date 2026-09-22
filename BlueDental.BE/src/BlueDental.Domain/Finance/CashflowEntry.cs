using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Finance;

/// <summary>
/// One movement of the clinic's money — deposit, withdrawal, or a transfer
/// between two holdings (Luân chuyển dòng tiền V2).
///
/// Reference: <c>/api/v1/cash-management/cashflow-entries</c>, with the toolbar
/// actions Nạp / Rút / Luân chuyển
/// (permission <c>reportTransfer.deposit|withdraw|transfer</c>).
/// </summary>
public class CashflowEntry : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public CashTransactionType TransactionType { get; private set; }

    /// <summary>Where the money leaves from. Null for a deposit.</summary>
    public CashHolding? FromHolding { get; private set; }

    /// <summary>Where the money lands. Null for a withdrawal.</summary>
    public CashHolding? ToHolding { get; private set; }

    public decimal Amount { get; private set; }

    /// <summary>Danh mục — a <see cref="CashflowCategory"/> with AppliesToTransfers = true.</summary>
    public Guid? CategoryId { get; private set; }

    public Guid CreatedByStaffId { get; private set; }

    public DateOnly EntryDate { get; private set; }

    public string? Note { get; private set; }

    protected CashflowEntry() { }

    /// <summary>Nạp — money enters a holding.</summary>
    public static CashflowEntry Deposit(
        Guid id,
        Guid clinicBranchId,
        CashHolding toHolding,
        decimal amount,
        Guid createdByStaffId,
        DateOnly entryDate,
        Guid? categoryId = null,
        string? note = null)
    {
        GuardAmount(amount);

        return new CashflowEntry
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            TransactionType = CashTransactionType.Deposit,
            FromHolding = null,
            ToHolding = toHolding,
            Amount = amount,
            CategoryId = categoryId,
            CreatedByStaffId = createdByStaffId,
            EntryDate = entryDate,
            Note = note
        };
    }

    /// <summary>Rút — money leaves a holding.</summary>
    public static CashflowEntry Withdraw(
        Guid id,
        Guid clinicBranchId,
        CashHolding fromHolding,
        decimal amount,
        Guid createdByStaffId,
        DateOnly entryDate,
        Guid? categoryId = null,
        string? note = null)
    {
        GuardAmount(amount);

        return new CashflowEntry
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            TransactionType = CashTransactionType.Withdraw,
            FromHolding = fromHolding,
            ToHolding = null,
            Amount = amount,
            CategoryId = categoryId,
            CreatedByStaffId = createdByStaffId,
            EntryDate = entryDate,
            Note = note
        };
    }

    /// <summary>Luân chuyển — money moves between two holdings.</summary>
    public static CashflowEntry Transfer(
        Guid id,
        Guid clinicBranchId,
        CashHolding fromHolding,
        CashHolding toHolding,
        decimal amount,
        Guid createdByStaffId,
        DateOnly entryDate,
        Guid? categoryId = null,
        string? note = null)
    {
        GuardAmount(amount);

        if (fromHolding == toHolding)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.SameTransferHolding,
                "A transfer must move money between two different holdings.");
        }

        return new CashflowEntry
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            TransactionType = CashTransactionType.Transfer,
            FromHolding = fromHolding,
            ToHolding = toHolding,
            Amount = amount,
            CategoryId = categoryId,
            CreatedByStaffId = createdByStaffId,
            EntryDate = entryDate,
            Note = note
        };
    }

    /// <summary>
    /// "Cập nhật giao dịch nạp/rút/luân chuyển" — the reference lets the
    /// method, amount, category and note of a booked movement be corrected;
    /// the transaction type and the execution date stay as booked.
    /// </summary>
    public CashflowEntry Revise(
        CashHolding? fromHolding,
        CashHolding? toHolding,
        decimal amount,
        Guid? categoryId,
        string? note)
    {
        GuardAmount(amount);

        switch (TransactionType)
        {
            case CashTransactionType.Deposit:
                ToHolding = RequireHolding(toHolding);
                FromHolding = null;
                break;
            case CashTransactionType.Withdraw:
                FromHolding = RequireHolding(fromHolding);
                ToHolding = null;
                break;
            case CashTransactionType.Transfer:
                if (fromHolding == toHolding)
                {
                    throw new BusinessException(
                        BlueDentalDomainErrorCodes.Finance.SameTransferHolding,
                        "A transfer must move money between two different holdings.");
                }
                FromHolding = RequireHolding(fromHolding);
                ToHolding = RequireHolding(toHolding);
                break;
        }

        Amount = amount;
        CategoryId = categoryId;
        Note = note;
        return this;
    }

    public CashflowEntry UpdateNote(string? note)
    {
        Note = note;
        return this;
    }

    public CashflowEntry Recategorize(Guid? categoryId)
    {
        CategoryId = categoryId;
        return this;
    }

    /// <summary>Signed effect of this entry on the given holding's balance.</summary>
    public decimal EffectOn(CashHolding holding)
    {
        var effect = 0m;

        if (ToHolding == holding)
        {
            effect += Amount;
        }

        if (FromHolding == holding)
        {
            effect -= Amount;
        }

        return effect;
    }

    private static CashHolding RequireHolding(CashHolding? holding)
    {
        return holding ?? throw new BusinessException(
            BlueDentalDomainErrorCodes.Finance.SameTransferHolding,
            "A holding is required for this transaction type.");
    }

    private static void GuardAmount(decimal amount)
    {
        if (amount <= 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.InvalidAmount,
                "A cashflow amount must be greater than zero.");
        }
    }
}
