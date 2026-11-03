using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Labo;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// The card a warranty công đoạn is worked under (P3110 REQ-F3..F5): "Nha khoa"
/// = the line's dental cards valid today, "Labo" = one order of the line with an
/// activated, unexpired tooth warranty.
/// </summary>
public class WarrantyCoverTests
{
    private static readonly TimeSpan Clinic = TimeSpan.FromHours(7);
    private static readonly DateOnly Start = new(2026, 10, 8);
    private static readonly DateOnly Today = new(2026, 10, 31);
    private static readonly DateTimeOffset CheckedAt = new(2026, 10, 8, 11, 0, 0, Clinic);

    private static TreatmentService Line(params int[] teeth)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 1, DiscountType.None, 0m,
            teeth.Select(code => new ToothSelection(code, selected: true)).ToList());
        line.SetInitialStatus(TreatmentServiceStatus.Done);
        return line;
    }

    private static IReadOnlyList<ServiceWarrantyCard> Cards(TreatmentService line, int months, params int?[] teeth) =>
        ServiceWarrantyCard.ActivateAll(
            Guid.NewGuid, line, new ServiceWarrantyTerms(365, null), [],
            teeth.Select(t => new ServiceWarrantyActivation(t, Start, months)).ToList(),
            WarrantyTestCodes.For(teeth.Length), CheckedAt, null);

    private static LaboOrder Order(Guid lineId, int months, params int[] teeth)
    {
        var details = new LaboOrderDetails
        {
            DentistId = Guid.NewGuid(),
            LabProviderName = "Labo A",
            SupplierId = Guid.NewGuid(),
            MaterialId = Guid.NewGuid(),
            Teeth = teeth,
            ToothShade = "A2",
            FinishLineId = Guid.NewGuid(),
            Quantity = 1,
            SentAt = CheckedAt.AddDays(-7),
            DueAt = CheckedAt.AddHours(-2),
            TreatmentServiceId = lineId
        };
        var order = new LaboOrder(Guid.NewGuid(), "LABO-1", Guid.NewGuid(), Guid.NewGuid(), details)
            .Submit()
            .Receive(Guid.NewGuid(), CheckedAt.AddHours(-1), 1, null)
            .ConfirmPassed(teeth.Select(t => new LaboRoundToothResult(t, LaboToothCheckResult.Passed)).ToList(), CheckedAt);
        return months == 0
            ? order
            : order.ActivateWarranty(
                teeth.Select(t => new LaboWarrantyActivation(t, Start, months)).ToList(),
                WarrantyTestCodes.For(teeth.Length), CheckedAt, null);
    }

    private static List<ToothSelection> Teeth(params int[] codes) =>
        codes.Select(code => new ToothSelection(code, selected: true)).ToList();

    private static void ShouldRefuse(Action act, string code) =>
        Should.Throw<BusinessException>(act).Code.ShouldBe(code);

    [Fact]
    public void A_kind_must_be_picked()
    {
        var line = Line(36);
        ShouldRefuse(() => WarrantyCover.Resolve(null, null, line.Id, Cards(line, 12, 36), [], Today),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyKindRequired);
    }

    [Fact]
    public void Dental_covers_the_teeth_of_the_valid_cards()
    {
        var line = Line(36, 37);
        var cards = Cards(line, 12, 36).Concat(Cards(line, 1, 37)).ToList();

        // 37's one-month card ended 2026-11-08 — still valid on the 31st.
        var cover = WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, cards, [], Today);
        cover.Kind.ShouldBe(WarrantyCardKind.Dental);
        cover.LaboOrderId.ShouldBeNull();
        cover.Teeth!.OrderBy(t => t).ShouldBe([36, 37]);

        // A month later 37's card is over: only 36 can be worked under warranty.
        var later = WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, cards, [], Today.AddMonths(1));
        later.Teeth.ShouldBe([36]);
        later.EnsureCovers(Teeth(36));
        ShouldRefuse(() => later.EnsureCovers(Teeth(36, 37)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothNotCovered);
    }

    [Fact]
    public void Dental_needs_a_valid_card_and_names_no_order()
    {
        var line = Line(36);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, [], [], Today),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyCardNotValid);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, Cards(line, 1, 36), [], Today.AddMonths(2)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyCardNotValid);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Dental, Guid.NewGuid(), line.Id, Cards(line, 12, 36), [], Today),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLaboOrderInvalid);

        // Another line's card does not count.
        var other = Line(36);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, Cards(other, 12, 36), [], Today),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyCardNotValid);
    }

    [Fact]
    public void A_toothless_card_covers_the_whole_line()
    {
        var line = Line();
        var cover = WarrantyCover.Resolve(WarrantyCardKind.Dental, null, line.Id, Cards(line, 12, [null]), [], Today);

        cover.Teeth.ShouldBeNull();
        cover.EnsureCovers(Teeth(11, 48));
    }

    [Fact]
    public void Labo_covers_the_activated_teeth_of_the_picked_order()
    {
        var lineId = Guid.NewGuid();
        var order = Order(lineId, 12, 11, 21);

        var cover = WarrantyCover.Resolve(WarrantyCardKind.Labo, order.Id, lineId, [], [order], Today);

        cover.Kind.ShouldBe(WarrantyCardKind.Labo);
        cover.LaboOrderId.ShouldBe(order.Id);
        cover.Teeth!.OrderBy(t => t).ShouldBe([11, 21]);
        ShouldRefuse(() => cover.EnsureCovers(Teeth(11, 22)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothNotCovered);
    }

    [Fact]
    public void Labo_needs_an_order_of_the_line_with_a_live_warranty()
    {
        var lineId = Guid.NewGuid();
        var notActivated = Order(lineId, 0, 11);
        var expired = Order(lineId, 1, 11);
        var elsewhere = Order(Guid.NewGuid(), 12, 11);
        var code = BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLaboOrderInvalid;

        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Labo, null, lineId, [], [notActivated], Today), code);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Labo, notActivated.Id, lineId, [], [notActivated], Today), code);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Labo, expired.Id, lineId, [], [expired], Today.AddMonths(1)), code);
        ShouldRefuse(() => WarrantyCover.Resolve(WarrantyCardKind.Labo, elsewhere.Id, lineId, [], [elsewhere], Today), code);
    }
}
