using System;
using System.Linq;
using BlueDental.Billing;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.PrepaidCards;

/// <summary>
/// Thẻ trả trước (cụm 3): a type's terms, selling a card from it, topping it
/// up, spending it on a receipt within its scope, and giving value back.
/// </summary>
public class PrepaidCardTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid Owner = Guid.NewGuid();
    private static readonly Guid Spouse = Guid.NewGuid();
    private static readonly Guid Seller = Guid.NewGuid();
    private static readonly Guid Scaling = Guid.NewGuid();
    private static readonly Guid Whitening = Guid.NewGuid();
    private static readonly Guid Hygiene = Guid.NewGuid();
    private static readonly DateTimeOffset Now = new(2026, 10, 8, 9, 0, 0, TimeSpan.FromHours(7));

    private static PrepaidCardType Type(
        decimal salePrice = 9_000_000m,
        decimal usageValue = 10_000_000m,
        int? maxUses = null,
        PrepaidCardCommissionType commissionType = PrepaidCardCommissionType.Percent,
        decimal commission = 5m,
        bool allowFamily = true,
        Guid[]? services = null,
        Guid[]? groups = null) =>
        new(Guid.NewGuid(), Branch, "Thẻ VIP", salePrice, usageValue, maxUses, commissionType, commission,
            allowFamily, services, groups);

    private static PrepaidCard Sell(PrepaidCardType type, params Guid[] members) =>
        PrepaidCard.Sell(Guid.NewGuid(), "TT26-0001", type, Branch, Owner, members, Seller, Now,
            PaymentMethodKind.Cash, null, Seller, null, Guid.NewGuid());

    private static PrepaidCard Spend(PrepaidCard card, decimal amount, Guid? patient = null, Guid? payment = null,
        params (Guid, Guid?)[] services) =>
        card.Spend(payment ?? Guid.NewGuid(), patient ?? Owner, amount,
            services.Length == 0 ? [(Scaling, Hygiene)] : services, Now, Seller, Guid.NewGuid());

    private static void ShouldFail(Action action, string code) =>
        Should.Throw<BusinessException>(action).Code.ShouldBe(code);

    [Fact]
    public void Selling_Loads_The_Usage_Value_And_Fixes_The_Commission()
    {
        var card = Sell(Type());

        card.Balance.ShouldBe(10_000_000m);
        card.TotalLoaded.ShouldBe(10_000_000m);
        card.SalePrice.ShouldBe(9_000_000m);
        card.CommissionAmount.ShouldBe(450_000m);
        card.Status.ShouldBe(PrepaidCardStatus.Active);

        var issue = card.Transactions.Single();
        issue.Type.ShouldBe(PrepaidCardTransactionType.Issue);
        issue.Value.ShouldBe(10_000_000m);
        issue.PaidAmount.ShouldBe(9_000_000m);
        issue.Method.ShouldBe(PaymentMethodKind.Cash);
    }

    [Fact]
    public void A_Fixed_Commission_Is_Paid_As_Is()
    {
        Sell(Type(commissionType: PrepaidCardCommissionType.Amount, commission: 300_000m))
            .CommissionAmount.ShouldBe(300_000m);
    }

    [Fact]
    public void A_Type_Refuses_Nonsense_Terms()
    {
        ShouldFail(() => Type(usageValue: 0m), BlueDentalDomainErrorCodes.PrepaidCard.InvalidValue);
        ShouldFail(() => Type(salePrice: -1m), BlueDentalDomainErrorCodes.PrepaidCard.InvalidValue);
        ShouldFail(() => Type(maxUses: 0), BlueDentalDomainErrorCodes.PrepaidCard.InvalidMaxUses);
        ShouldFail(() => Type(commission: 101m), BlueDentalDomainErrorCodes.PrepaidCard.InvalidCommission);
        ShouldFail(() => Type(commissionType: PrepaidCardCommissionType.Amount, commission: 9_000_001m),
            BlueDentalDomainErrorCodes.PrepaidCard.InvalidCommission);
    }

    [Fact]
    public void A_Card_Keeps_The_Terms_It_Was_Sold_With()
    {
        var type = Type(maxUses: 5, services: [Scaling]);
        var card = Sell(type);

        type.Update("Thẻ mới", 1m, 2m, 1, PrepaidCardCommissionType.Percent, 0m, false, [], [], null);

        card.Name.ShouldBe("Thẻ VIP");
        card.MaxUses.ShouldBe(5);
        card.ServiceIds.ShouldBe(new[] { Scaling });
        card.AllowFamily.ShouldBeTrue();
    }

    [Fact]
    public void A_Type_Off_Sale_Cannot_Be_Sold()
    {
        ShouldFail(() => Sell(Type().SetOnSale(false)), BlueDentalDomainErrorCodes.PrepaidCard.TypeNotOnSale);
    }

    [Fact]
    public void A_Card_Is_Bought_With_Money()
    {
        ShouldFail(() => PrepaidCard.Sell(Guid.NewGuid(), "TT26-0001", Type(), Branch, Owner, [], Seller, Now,
                PaymentMethodKind.OutstandingDebt, null, Seller, null, Guid.NewGuid()),
            BlueDentalDomainErrorCodes.PrepaidCard.InvalidSaleMethod);
        ShouldFail(() => PrepaidCard.Sell(Guid.NewGuid(), "TT26-0001", Type(), Branch, Owner, [], Seller, Now,
                PaymentMethodKind.Banking, null, Seller, null, Guid.NewGuid()),
            BlueDentalDomainErrorCodes.Billing.PaymentAccountRequired);
    }

    [Fact]
    public void Family_Members_Need_A_Family_Card_And_Must_Be_Distinct_From_The_Owner()
    {
        ShouldFail(() => Sell(Type(allowFamily: false), Spouse), BlueDentalDomainErrorCodes.PrepaidCard.FamilyNotAllowed);
        ShouldFail(() => Sell(Type(), Owner), BlueDentalDomainErrorCodes.PrepaidCard.InvalidMembers);
        ShouldFail(() => Sell(Type(), Spouse, Spouse), BlueDentalDomainErrorCodes.PrepaidCard.InvalidMembers);

        var card = Sell(Type(), Spouse);
        card.CanBeUsedBy(Spouse).ShouldBeTrue();
        card.CanBeUsedBy(Guid.NewGuid()).ShouldBeFalse();
    }

    [Fact]
    public void Spending_Takes_The_Amount_And_One_Use()
    {
        var payment = Guid.NewGuid();
        var card = Spend(Sell(Type(maxUses: 3), Spouse), 2_500_000m, Spouse, payment);

        card.Balance.ShouldBe(7_500_000m);
        card.UsedCount.ShouldBe(1);
        card.RemainingUses.ShouldBe(2);
        card.HeldFor(payment).ShouldBe(2_500_000m);
        card.Transactions.Last().PatientId.ShouldBe(Spouse);
    }

    [Fact]
    public void Spending_Is_Refused_Beyond_The_Balance_The_Uses_Or_The_Holders()
    {
        var card = Sell(Type(maxUses: 1));
        ShouldFail(() => Spend(card, 10_000_001m), BlueDentalDomainErrorCodes.PrepaidCard.InsufficientBalance);
        ShouldFail(() => Spend(card, 1m, Guid.NewGuid()), BlueDentalDomainErrorCodes.PrepaidCard.NotCardHolder);

        Spend(card, 1_000m);
        card.IsExhausted.ShouldBeTrue();
        ShouldFail(() => Spend(card, 1_000m), BlueDentalDomainErrorCodes.PrepaidCard.UsesExhausted);
    }

    [Fact]
    public void A_Card_Pays_Only_For_Its_Services_And_Service_Groups()
    {
        var card = Sell(Type(services: [Whitening], groups: [Hygiene]));

        Spend(card, 100m, services: (Whitening, Guid.NewGuid()));
        Spend(card, 100m, services: (Scaling, Hygiene));
        ShouldFail(() => Spend(card, 100m, services: (Guid.NewGuid(), Guid.NewGuid())),
            BlueDentalDomainErrorCodes.PrepaidCard.ServiceNotCovered);
        ShouldFail(() => Spend(card, 100m, services: [(Whitening, null), (Guid.NewGuid(), null)]),
            BlueDentalDomainErrorCodes.PrepaidCard.ServiceNotCovered);
    }

    [Fact]
    public void A_Card_With_No_Scope_Pays_For_Any_Service()
    {
        Spend(Sell(Type()), 100m, services: (Guid.NewGuid(), null)).Balance.ShouldBe(9_999_900m);
    }

    [Fact]
    public void Releasing_Gives_Back_The_Value_And_The_Use_Once()
    {
        var payment = Guid.NewGuid();
        var card = Spend(Sell(Type(maxUses: 1)), 4_000_000m, payment: payment);

        card.Release(payment, Now, Seller, "Huỷ phiếu", Guid.NewGuid());
        card.Release(payment, Now, Seller, "Huỷ phiếu", Guid.NewGuid());

        card.Balance.ShouldBe(10_000_000m);
        card.UsedCount.ShouldBe(0);
        card.HeldFor(payment).ShouldBe(0m);
        card.Transactions.Count(t => t.Type == PrepaidCardTransactionType.Refund).ShouldBe(1);
        Spend(card, 1m).UsedCount.ShouldBe(1);
    }

    [Fact]
    public void Topping_Up_Adds_Value_For_The_Money_Taken()
    {
        var card = Sell(Type());
        card.Topup(5_000_000m, 4_500_000m, PaymentMethodKind.Card, null, Now, Seller, null, Guid.NewGuid());

        card.Balance.ShouldBe(15_000_000m);
        card.TotalLoaded.ShouldBe(15_000_000m);
        card.Transactions.Last().PaidAmount.ShouldBe(4_500_000m);
        card.Transactions.Select(t => t.Sequence).ShouldBe(new[] { 1, 2 });
        ShouldFail(() => card.Topup(0m, 0m, PaymentMethodKind.Cash, null, Now, Seller, null, Guid.NewGuid()),
            BlueDentalDomainErrorCodes.PrepaidCard.InvalidTopup);
    }

    [Fact]
    public void A_Locked_Card_Neither_Loads_Nor_Pays_But_Still_Takes_Value_Back()
    {
        var payment = Guid.NewGuid();
        var card = Spend(Sell(Type()), 1_000m, payment: payment).Lock();

        ShouldFail(() => Spend(card, 1m), BlueDentalDomainErrorCodes.PrepaidCard.CardLocked);
        ShouldFail(() => card.Topup(1m, 1m, PaymentMethodKind.Cash, null, Now, Seller, null, Guid.NewGuid()),
            BlueDentalDomainErrorCodes.PrepaidCard.CardLocked);

        card.Release(payment, Now, Seller, null, Guid.NewGuid()).Balance.ShouldBe(10_000_000m);
        card.Unlock();
        Spend(card, 1m).Balance.ShouldBe(9_999_999m);
    }

    [Fact]
    public void A_Card_Receipt_Must_Be_A_Payment_Naming_Its_Card()
    {
        ShouldFail(() => PatientPayment.Record(Guid.NewGuid(), Owner, Branch, PatientPaymentKind.Payment,
                PaymentMethodKind.PrepaidCard, 100m, "THANHTOAN-01/DT01/2026", Seller, Now, Guid.NewGuid()),
            BlueDentalDomainErrorCodes.PrepaidCard.CardRequired);

        var cardId = Guid.NewGuid();
        PatientPayment.Record(Guid.NewGuid(), Owner, Branch, PatientPaymentKind.Payment,
                PaymentMethodKind.PrepaidCard, 100m, "THANHTOAN-01/DT01/2026", Seller, Now, Guid.NewGuid(),
                prepaidCardId: cardId)
            .PrepaidCardId.ShouldBe(cardId);

        PatientPayment.Record(Guid.NewGuid(), Owner, Branch, PatientPaymentKind.Payment,
                PaymentMethodKind.Cash, 100m, "THANHTOAN-01/DT01/2026", Seller, Now, Guid.NewGuid(),
                prepaidCardId: cardId)
            .PrepaidCardId.ShouldBeNull();
    }
}
