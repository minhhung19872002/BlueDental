using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>"Bảo hành dịch vụ" on the plan's Bảo hành tab (P3110 REQ-B5, owner D4).</summary>
public class ServiceWarrantyCardTests
{
    private static readonly DateOnly Finished = new(2026, 10, 30);
    private static readonly ServiceWarrantyTerms Terms = new(365, Finished);
    private static readonly int?[] NoneYet = [];

    private static TreatmentService Line(bool done = true, params int[] teeth)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 1, DiscountType.None, 0m,
            teeth.Select(code => new ToothSelection(code, selected: true)).ToList());
        if (done) line.SetInitialStatus(TreatmentServiceStatus.Done);
        return line;
    }

    private static IReadOnlyList<ServiceWarrantyCard> Activate(
        TreatmentService line, IReadOnlyCollection<int?> already, params ServiceWarrantyActivation[] cards) =>
        ServiceWarrantyCard.ActivateAll(
            Guid.NewGuid, line, Terms, already, cards, DateTimeOffset.UtcNow, Guid.NewGuid());

    private static void ShouldRefuse(Action act, string code) =>
        Should.Throw<BusinessException>(act).Code.ShouldBe(code);

    [Fact]
    public void Each_tooth_gets_its_own_card_coded_after_the_line_and_start_day()
    {
        var line = Line(true, 36, 37);

        var cards = Activate(line, NoneYet,
            new ServiceWarrantyActivation(36, Finished, 12, " Không dùng răng cắn vật cứng "),
            new ServiceWarrantyActivation(37, Finished, 12));

        cards.Select(c => c.Code).ShouldBe(["BH-DT01-01-30102026-36", "BH-DT01-01-30102026-37"]);
        cards[0].EndDate.ShouldBe(new DateOnly(2027, 10, 30));
        cards[0].DurationMonths.ShouldBe(12);
        cards[0].DurationDays.ShouldBeNull();
        cards[0].Conditions.ShouldBe("Không dùng răng cắn vật cứng");
        cards[1].Conditions.ShouldBeNull();
        cards.ShouldAllBe(c => c.TreatmentServiceId == line.Id && c.BranchId == line.ClinicBranchId);
    }

    [Fact]
    public void Without_months_the_card_follows_the_catalog_days()
    {
        var card = Activate(Line(true, 11), NoneYet, new ServiceWarrantyActivation(11, Finished)).Single();

        card.DurationMonths.ShouldBeNull();
        card.DurationDays.ShouldBe(365);
        card.EndDate.ShouldBe(Finished.AddDays(365));
    }

    [Fact]
    public void A_toothless_line_takes_one_card_numbered_00()
    {
        var line = Line(true);

        Activate(line, NoneYet, new ServiceWarrantyActivation(null, Finished)).Single()
            .Code.ShouldBe("BH-DT01-01-30102026-00");
        ShouldRefuse(() => Activate(line, [null], new ServiceWarrantyActivation(null, Finished)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothInvalid);
    }

    [Fact]
    public void Only_a_finished_line_is_warranted()
    {
        ShouldRefuse(() => Activate(Line(false, 11), NoneYet, new ServiceWarrantyActivation(11, Finished)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLineNotDone);
    }

    [Fact]
    public void A_service_without_a_warranty_period_is_refused()
    {
        ShouldRefuse(() => ServiceWarrantyCard.ActivateAll(
                Guid.NewGuid, Line(true, 11), new ServiceWarrantyTerms(0, Finished), NoneYet,
                [new ServiceWarrantyActivation(11, Finished)], DateTimeOffset.UtcNow, null),
            BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasNoWarranty);
    }

    [Theory]
    [InlineData(21)]
    [InlineData(null)]
    public void A_tooth_off_the_line_is_refused(int? tooth)
    {
        ShouldRefuse(() => Activate(Line(true, 11), NoneYet, new ServiceWarrantyActivation(tooth, Finished)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothInvalid);
    }

    [Fact]
    public void A_tooth_asked_twice_or_already_carded_is_refused()
    {
        var line = Line(true, 11, 21);

        ShouldRefuse(() => Activate(line, NoneYet,
                new ServiceWarrantyActivation(11, Finished), new ServiceWarrantyActivation(11, Finished)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothInvalid);
        ShouldRefuse(() => Activate(line, [11], new ServiceWarrantyActivation(11, Finished)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothInvalid);
        Activate(line, [11], new ServiceWarrantyActivation(21, Finished)).Single().ToothNumber.ShouldBe(21);
    }

    [Fact]
    public void The_card_cannot_start_before_the_line_was_finished()
    {
        ShouldRefuse(() => Activate(Line(true, 11), NoneYet, new ServiceWarrantyActivation(11, Finished.AddDays(-1))),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyStartBeforeCompletion);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(601)]
    public void Months_outside_1_to_600_are_refused(int months)
    {
        ShouldRefuse(() => Activate(Line(true, 11), NoneYet, new ServiceWarrantyActivation(11, Finished, months)),
            BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyDurationInvalid);
    }

    [Fact]
    public void A_card_expires_after_its_last_day()
    {
        var card = Activate(Line(true, 11), NoneYet, new ServiceWarrantyActivation(11, Finished, 1)).Single();

        card.IsExpiredOn(card.EndDate).ShouldBeFalse();
        card.IsExpiredOn(card.EndDate.AddDays(1)).ShouldBeTrue();
    }
}
