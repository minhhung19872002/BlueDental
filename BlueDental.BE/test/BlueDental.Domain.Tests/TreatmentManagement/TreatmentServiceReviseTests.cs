using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// "Chỉnh sửa" on the plan table — what staging's column builder allows a saved
/// line to change (measured 2026-09-24).
/// </summary>
public class TreatmentServiceReviseTests
{
    private static readonly HashSet<int> NothingStaged = [];

    private static List<ToothSelection> Teeth(params int[] codes) =>
        codes.Select(code => new ToothSelection(code, selected: true)).ToList();

    private static TreatmentService Line(TreatmentServiceStatus status = TreatmentServiceStatus.Created)
    {
        var plan = TreatmentPlan.Open(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "DT01", "Kế hoạch");
        var line = plan.AddService(
            Guid.NewGuid(), Guid.NewGuid(), null, 1_000_000m, 2, DiscountType.None, 0m, Teeth(11, 21));
        if (status != TreatmentServiceStatus.Created)
        {
            line.SetInitialStatus(status);
        }

        return line;
    }

    [Fact]
    public void A_fresh_line_takes_new_price_teeth_and_diagnosis()
    {
        var line = Line();
        var diagnosis = Guid.NewGuid();

        line.Revise(900_000m, 3, Teeth(11, 21, 22), diagnosis, 0m, NothingStaged);

        line.Price.ShouldBe(900_000m);
        line.Quantity.ShouldBe(3);
        line.DiagnosisId.ShouldBe(diagnosis);
        line.Teeth.Select(t => t.ToothCode).ShouldBe([11, 21, 22]);
    }

    [Theory]
    [InlineData(TreatmentServiceStatus.Done)]
    [InlineData(TreatmentServiceStatus.Cancelled)]
    [InlineData(TreatmentServiceStatus.Replaced)]
    public void A_closed_line_cannot_be_edited(TreatmentServiceStatus status)
    {
        Should.Throw<BusinessException>(() =>
                Line(status).Revise(1_000_000m, 2, Teeth(11, 21), null, 0m, NothingStaged))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineNotEditable);
    }

    [Fact]
    public void A_line_paid_on_cannot_be_edited()
    {
        Should.Throw<BusinessException>(() =>
                Line().Revise(1_000_000m, 2, Teeth(11, 21), null, 500_000m, NothingStaged))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineNotEditable);
    }

    [Fact]
    public void A_line_in_treatment_keeps_its_price_and_diagnosis()
    {
        var line = Line(TreatmentServiceStatus.InProgress);

        Should.Throw<BusinessException>(() =>
                line.Revise(800_000m, 2, Teeth(11, 21), null, 0m, NothingStaged))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineLockedInTreatment);
        Should.Throw<BusinessException>(() =>
                line.Revise(1_000_000m, 2, Teeth(11, 21), Guid.NewGuid(), 0m, NothingStaged))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceLineLockedInTreatment);

        // Everything else still moves.
        line.Revise(1_000_000m, 3, Teeth(11, 21, 22), null, 0m, NothingStaged);
        line.Quantity.ShouldBe(3);
    }

    [Fact]
    public void A_tooth_with_a_stage_stays_on_the_line()
    {
        Should.Throw<BusinessException>(() =>
                Line(TreatmentServiceStatus.InProgress)
                    .Revise(1_000_000m, 1, Teeth(21), null, 0m, new HashSet<int> { 11 }))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StagedToothLocked);
    }
}
