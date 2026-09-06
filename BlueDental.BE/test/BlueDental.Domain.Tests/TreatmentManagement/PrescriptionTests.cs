using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Catalogs;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class PrescriptionTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private static PrescriptionItem Line(
        Guid? medicationId = null,
        int timesPerDay = 2,
        decimal amountPerTime = 1m,
        int days = 5,
        PrescriptionUsage usage = PrescriptionUsage.AfterMeal,
        string? otherUsage = null,
        int sortOrder = 0)
    {
        return new PrescriptionItem(
            Guid.NewGuid(),
            medicationId ?? Guid.NewGuid(),
            "Amoxicillin 500mg",
            timesPerDay,
            amountPerTime,
            days,
            usage,
            otherUsage,
            sortOrder);
    }

    private Prescription Issue(IEnumerable<PrescriptionItem>? items = null)
    {
        return Prescription.Issue(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            "DT26-0001",
            _staffId,
            items ?? [Line()],
            diagnosisText: "  Sâu ngà  ",
            note: "Uống sau ăn",
            followUpDate: new DateOnly(2026, 9, 20));
    }

    [Fact]
    public void Issue_Should_Default_To_Outpatient_And_Trim_Text()
    {
        var prescription = Issue();

        Assert.Equal(PrescriptionTreatmentType.Outpatient, prescription.TreatmentType);
        Assert.Equal("Sâu ngà", prescription.DiagnosisText);
        Assert.Equal("Uống sau ăn", prescription.Note);
        Assert.Equal(new DateOnly(2026, 9, 20), prescription.FollowUpDate);
        Assert.Single(prescription.Items);
    }

    [Fact]
    public void Issue_Should_Attach_Lines_To_The_Slip()
    {
        var prescription = Issue();

        Assert.All(prescription.Items, item => Assert.Equal(prescription.Id, item.PrescriptionId));
    }

    [Fact]
    public void Issue_Should_Reject_Empty_Lines()
    {
        var ex = Assert.Throws<BusinessException>(() => Issue([]));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.EmptyPrescription, ex.Code);
    }

    [Fact]
    public void Issue_Should_Reject_Blank_Code()
    {
        Assert.ThrowsAny<ArgumentException>(() => Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, " ", _staffId, [Line()]));
    }

    [Fact]
    public void Issue_Should_Reject_Missing_Doctor()
    {
        var ex = Assert.Throws<BusinessException>(() => Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, "DT26-0001", Guid.Empty, [Line()]));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Issue_Should_Reject_The_Same_Medicine_Twice()
    {
        var medicine = Guid.NewGuid();

        var ex = Assert.Throws<BusinessException>(() =>
            Issue([Line(medicine), Line(medicine, sortOrder: 1)]));

        Assert.Equal(
            BlueDentalDomainErrorCodes.TreatmentManagement.DuplicatePrescriptionMedicine, ex.Code);
    }

    [Fact]
    public void Issue_Should_Order_Lines_By_SortOrder()
    {
        var first = Line(sortOrder: 0);
        var second = Line(sortOrder: 1);

        var prescription = Issue([second, first]);

        Assert.Equal([first.Id, second.Id], prescription.Items.Select(i => i.Id).ToList());
    }

    [Fact]
    public void UpdateDetails_Should_Replace_Header_And_Lines()
    {
        var prescription = Issue();
        var doctor = Guid.NewGuid();
        var replacement = Line(timesPerDay: 1, amountPerTime: 0.5m, days: 3);

        prescription.UpdateDetails(
            doctor,
            "Viêm tủy",
            null,
            PrescriptionTreatmentType.Inpatient,
            null,
            [replacement]);

        Assert.Equal(doctor, prescription.StaffId);
        Assert.Equal("Viêm tủy", prescription.DiagnosisText);
        Assert.Null(prescription.Note);
        Assert.Equal(PrescriptionTreatmentType.Inpatient, prescription.TreatmentType);
        Assert.Null(prescription.FollowUpDate);
        Assert.Equal(replacement.Id, Assert.Single(prescription.Items).Id);
        Assert.Equal(prescription.Id, replacement.PrescriptionId);
    }

    [Fact]
    public void UpdateDetails_Should_Keep_The_Slip_When_Lines_Are_Invalid()
    {
        var prescription = Issue();
        var before = prescription.StaffId;

        Assert.Throws<BusinessException>(() => prescription.UpdateDetails(
            Guid.NewGuid(), "x", null, PrescriptionTreatmentType.Outpatient, null, []));

        Assert.Equal(before, prescription.StaffId);
        Assert.Single(prescription.Items);
    }

    [Fact]
    public void UpdateDetails_Should_Reject_Unknown_Treatment_Type()
    {
        var prescription = Issue();

        var ex = Assert.Throws<BusinessException>(() => prescription.UpdateDetails(
            _staffId, null, null, (PrescriptionTreatmentType)9, null, [Line()]));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Item_Quantity_Should_Be_Times_Amount_Days()
    {
        var line = Line(timesPerDay: 3, amountPerTime: 0.5m, days: 4);

        Assert.Equal(6m, line.Quantity);
    }

    [Theory]
    [InlineData(0, 1, 1)]
    [InlineData(1, 0, 1)]
    [InlineData(1, 1, 0)]
    [InlineData(-1, 1, 1)]
    public void Item_Should_Reject_Non_Positive_Dosing(int times, double amount, int days)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            Line(timesPerDay: times, amountPerTime: (decimal)amount, days: days));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Item_Should_Reject_Empty_Medicine()
    {
        var ex = Assert.Throws<BusinessException>(() => Line(Guid.Empty));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Item_Should_Require_Text_For_Other_Usage()
    {
        var ex = Assert.Throws<BusinessException>(() =>
            Line(usage: PrescriptionUsage.Other, otherUsage: "  "));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Item_Should_Keep_Other_Text_Only_When_Flag_Is_Set()
    {
        var withFlag = Line(usage: PrescriptionUsage.AfterMeal | PrescriptionUsage.Other, otherUsage: " Ngậm ");
        var withoutFlag = Line(usage: PrescriptionUsage.AfterMeal, otherUsage: "Ngậm");

        Assert.Equal("Ngậm", withFlag.OtherUsage);
        Assert.Null(withoutFlag.OtherUsage);
    }

    [Fact]
    public void Item_Should_Trim_Medicine_Name()
    {
        var line = new PrescriptionItem(
            Guid.NewGuid(), Guid.NewGuid(), "  Paracetamol  ", 1, 1m, 1, PrescriptionUsage.None, null, 0);

        Assert.Equal("Paracetamol", line.MedicationName);
    }
}
