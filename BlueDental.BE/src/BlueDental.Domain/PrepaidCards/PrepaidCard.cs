using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Billing;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.PrepaidCards;

/// <summary>
/// A Thẻ trả trước sold to a customer — "bán và phát hành thẻ" (cụm 3 mục 1)
/// and "tình trạng thẻ" (mục 2). BlueDental-local; see
/// docs/clone/pages/prepaid-card.md.
///
/// The card copies its type's terms when sold, then lives on its own: the
/// balance goes up when it is sold or topped up and down when a payment
/// receipt is paid from it, and every movement leaves a line in
/// <see cref="Transactions"/>.
/// </summary>
public class PrepaidCard : FullAuditedAggregateRoot<Guid>
{
    private readonly List<PrepaidCardTransaction> _transactions = new();

    /// <summary>The branch that sold the card and manages it.</summary>
    public Guid ClinicBranchId { get; private set; }

    /// <summary>Mã thẻ — <c>TT26-0001</c>.</summary>
    public string Code { get; private set; } = string.Empty;

    public Guid CardTypeId { get; private set; }

    /// <summary>The type's name when the card was sold.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Chủ thẻ.</summary>
    public Guid OwnerPatientId { get; private set; }

    public bool AllowFamily { get; private set; }

    private List<Guid> _memberPatientIds = [];

    /// <summary>Family members who may spend the card besides its owner.</summary>
    public IReadOnlyList<Guid> MemberPatientIds => _memberPatientIds;

    public int? MaxUses { get; private set; }

    private List<Guid> _serviceIds = [];
    public IReadOnlyList<Guid> ServiceIds => _serviceIds;

    private List<Guid> _serviceGroupIds = [];
    public IReadOnlyList<Guid> ServiceGroupIds => _serviceGroupIds;

    /// <summary>What the customer paid for the card.</summary>
    public decimal SalePrice { get; private set; }

    /// <summary>What the card was loaded with when sold.</summary>
    public decimal UsageValue { get; private set; }

    /// <summary>Nhân viên bán — earns <see cref="CommissionAmount"/>.</summary>
    public Guid SellerStaffId { get; private set; }

    /// <summary>Hoa hồng khi bán, fixed at the sale from the type's terms.</summary>
    public decimal CommissionAmount { get; private set; }

    public DateTimeOffset SoldAt { get; private set; }

    /// <summary>Số dư — what is left to spend.</summary>
    public decimal Balance { get; private set; }

    /// <summary>Usage value loaded so far: the sale plus every top-up.</summary>
    public decimal TotalLoaded { get; private set; }

    /// <summary>Receipts currently paid from the card; a cancelled one gives its use back.</summary>
    public int UsedCount { get; private set; }

    public PrepaidCardStatus Status { get; private set; }

    public string? Note { get; private set; }

    public IReadOnlyCollection<PrepaidCardTransaction> Transactions => _transactions.AsReadOnly();

    public int? RemainingUses => MaxUses.HasValue ? Math.Max(0, MaxUses.Value - UsedCount) : null;

    /// <summary>Nothing left to spend, or no use left.</summary>
    public bool IsExhausted => Balance <= 0m || RemainingUses == 0;

    protected PrepaidCard() { }

    /// <summary>
    /// "Bán thẻ": copies the type's terms, fixes the seller's commission and
    /// loads the card with the type's usage value.
    /// </summary>
    public static PrepaidCard Sell(
        Guid id,
        string code,
        PrepaidCardType type,
        Guid clinicBranchId,
        Guid ownerPatientId,
        IEnumerable<Guid>? memberPatientIds,
        Guid sellerStaffId,
        DateTimeOffset soldAt,
        PaymentMethodKind method,
        Guid? paymentAccountId,
        Guid? cashierId,
        string? note,
        Guid transactionId)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code), PrepaidCardConsts.MaxCodeLength);
        Check.NotNull(type, nameof(type));

        if (!type.IsOnSale)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.TypeNotOnSale);
        }

        EnsureMoneyTaken(method, paymentAccountId);

        var card = new PrepaidCard
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Code = code,
            CardTypeId = type.Id,
            Name = type.Name,
            OwnerPatientId = ownerPatientId,
            AllowFamily = type.AllowFamily,
            MaxUses = type.MaxUses,
            _serviceIds = type.ServiceIds.ToList(),
            _serviceGroupIds = type.ServiceGroupIds.ToList(),
            SalePrice = type.SalePrice,
            UsageValue = type.UsageValue,
            SellerStaffId = sellerStaffId,
            CommissionAmount = type.CommissionFor(type.SalePrice),
            SoldAt = soldAt,
            Balance = type.UsageValue,
            TotalLoaded = type.UsageValue,
            Status = PrepaidCardStatus.Active,
            Note = TrimNote(note),
        };

        card.SetMembers(memberPatientIds);
        card.Append(new PrepaidCardTransaction(
            transactionId, 1, PrepaidCardTransactionType.Issue, type.UsageValue, soldAt, cashierId, null,
            type.SalePrice, method, Accounted(method, paymentAccountId)));
        return card;
    }

    /// <summary>Who besides the owner may spend the card.</summary>
    public PrepaidCard SetMembers(IEnumerable<Guid>? memberPatientIds)
    {
        var members = (memberPatientIds ?? []).Where(id => id != Guid.Empty).ToList();

        if (members.Count > 0 && !AllowFamily)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.FamilyNotAllowed);
        }

        if (members.Contains(OwnerPatientId)
            || members.Distinct().Count() != members.Count
            || members.Count > PrepaidCardConsts.MaxMembers)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidMembers)
                .WithData("Max", PrepaidCardConsts.MaxMembers);
        }

        _memberPatientIds = members;
        return this;
    }

    /// <summary>"Topup giá trị sử dụng thẻ" — adds usage value for money taken now.</summary>
    public PrepaidCard Topup(
        decimal value,
        decimal paidAmount,
        PaymentMethodKind method,
        Guid? paymentAccountId,
        DateTimeOffset occurredAt,
        Guid? staffId,
        string? note,
        Guid transactionId)
    {
        EnsureActive();

        if (value <= 0m || paidAmount < 0m)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidTopup);
        }

        EnsureMoneyTaken(method, paymentAccountId);

        Balance += value;
        TotalLoaded += value;
        Append(new PrepaidCardTransaction(
            transactionId, NextSequence, PrepaidCardTransactionType.Topup, value, occurredAt, staffId,
            TrimNote(note), paidAmount, method, Accounted(method, paymentAccountId)));
        return this;
    }

    /// <summary>
    /// Pays one receipt from the card. Each receipt is one use, whatever it
    /// covers. <paramref name="services"/> are the receipt's service lines as
    /// (catalog service, its service group).
    /// </summary>
    public PrepaidCard Spend(
        Guid patientPaymentId,
        Guid patientId,
        decimal amount,
        IReadOnlyCollection<(Guid ServiceId, Guid? ServiceGroupId)> services,
        DateTimeOffset occurredAt,
        Guid? staffId,
        Guid transactionId)
    {
        EnsureActive();

        if (!CanBeUsedBy(patientId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.NotCardHolder);
        }

        if (RemainingUses == 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.UsesExhausted)
                .WithData("Max", MaxUses!.Value);
        }

        if (services.Any(s => !Covers(s.ServiceId, s.ServiceGroupId)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.ServiceNotCovered);
        }

        if (amount <= 0m || amount > Balance)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InsufficientBalance)
                .WithData("Balance", Balance.ToString("N0"));
        }

        Balance -= amount;
        UsedCount++;
        Append(new PrepaidCardTransaction(
            transactionId, NextSequence, PrepaidCardTransactionType.Use, amount, occurredAt, staffId, null,
            patientId: patientId, patientPaymentId: patientPaymentId));
        return this;
    }

    /// <summary>
    /// Gives back what <paramref name="patientPaymentId"/> took from the card —
    /// its receipt was cancelled, or changed before the money was confirmed.
    /// Allowed on a locked card: it only returns value. A receipt the card no
    /// longer pays is left alone.
    /// </summary>
    public PrepaidCard Release(Guid patientPaymentId, DateTimeOffset occurredAt, Guid? staffId, string? note, Guid transactionId)
    {
        var held = HeldFor(patientPaymentId);
        if (held <= 0m)
        {
            return this;
        }

        var patientId = _transactions.First(t => t.PatientPaymentId == patientPaymentId).PatientId;
        Balance += held;
        UsedCount = Math.Max(0, UsedCount - 1);
        Append(new PrepaidCardTransaction(
            transactionId, NextSequence, PrepaidCardTransactionType.Refund, held, occurredAt, staffId,
            TrimNote(note), patientId: patientId, patientPaymentId: patientPaymentId));
        return this;
    }

    /// <summary>What a receipt currently has taken from the card.</summary>
    public decimal HeldFor(Guid patientPaymentId) =>
        _transactions
            .Where(t => t.PatientPaymentId == patientPaymentId)
            .Sum(t => -t.SignedValue);

    public PrepaidCard Lock()
    {
        Status = PrepaidCardStatus.Locked;
        return this;
    }

    public PrepaidCard Unlock()
    {
        Status = PrepaidCardStatus.Active;
        return this;
    }

    public bool CanBeUsedBy(Guid patientId) =>
        patientId == OwnerPatientId || _memberPatientIds.Contains(patientId);

    /// <summary>With no service and no group named, the card pays for any service.</summary>
    public bool Covers(Guid serviceId, Guid? serviceGroupId) =>
        (_serviceIds.Count == 0 && _serviceGroupIds.Count == 0)
        || _serviceIds.Contains(serviceId)
        || (serviceGroupId.HasValue && _serviceGroupIds.Contains(serviceGroupId.Value));

    private int NextSequence => _transactions.Count == 0 ? 1 : _transactions.Max(t => t.Sequence) + 1;

    private void Append(PrepaidCardTransaction transaction) => _transactions.Add(transaction);

    private void EnsureActive()
    {
        if (Status == PrepaidCardStatus.Locked)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.CardLocked);
        }
    }

    /// <summary>
    /// A card is bought with money: cash, bank transfer, card swipe or e-wallet.
    /// Dư nợ or another card would only move value around.
    /// </summary>
    private static void EnsureMoneyTaken(PaymentMethodKind method, Guid? paymentAccountId)
    {
        if (method is not (PaymentMethodKind.Cash or PaymentMethodKind.Banking
            or PaymentMethodKind.Card or PaymentMethodKind.EWallet))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PrepaidCard.InvalidSaleMethod);
        }

        if (PatientPayment.RequiresAccount(method) && !paymentAccountId.HasValue)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired);
        }
    }

    private static Guid? Accounted(PaymentMethodKind method, Guid? paymentAccountId) =>
        PatientPayment.RequiresAccount(method) ? paymentAccountId : null;

    private static string? TrimNote(string? note) =>
        string.IsNullOrWhiteSpace(note)
            ? null
            : Check.Length(note.Trim(), nameof(note), PrepaidCardConsts.MaxNoteLength);
}
