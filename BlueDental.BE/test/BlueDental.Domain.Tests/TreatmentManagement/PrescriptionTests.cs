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
        decimal morning = 1m,
        decimal noon = 0m,
        decimal afternoon = 0m,
        decimal evening = 1m,
        int days = 5,
        PrescriptionUsage usage = PrescriptionUsage.AfterMeal,
        string? otherUsage = null,
        int sortOrder = 0)
    {
        return new PrescriptionItem(
            Guid.NewGuid(),
            medicationId ?? Guid.NewGuid(),
            "Amoxicillin 500mg",
            morning,
            noon,
            afternoon,
            evening,
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
        var replacement = Line(morning: 0.5m, evening: 0m, days: 3);

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
    public void Item_Quantity_Should_Be_Sum_Of_Sessions_Times_Days()
    {
        var line = Line(morning: 1m, noon: 0.5m, afternoon: 0m, evening: 1m, days: 4);

        Assert.Equal(2.5m, line.DailyAmount);
        Assert.Equal(10m, line.Quantity);
    }

    [Theory]
    [InlineData(0, 0, 0, 0, 5)]
    [InlineData(1, 0, 0, 1, 0)]
    [InlineData(-1, 1, 0, 0, 5)]
    [InlineData(1, 0, -0.5, 0, 5)]
    public void Item_Should_Reject_Invalid_Session_Dosing(
        double morning, double noon, double afternoon, double evening, int days)
    {
        var ex = Assert.Throws<BusinessException>(() => Line(
            morning: (decimal)morning,
            noon: (decimal)noon,
            afternoon: (decimal)afternoon,
            evening: (decimal)evening,
            days: days));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPrescriptionLine, ex.Code);
    }

    [Fact]
    public void Item_Should_Allow_A_Single_Session()
    {
        var line = Line(morning: 0m, noon: 0m, afternoon: 0m, evening: 1m, days: 3);

        Assert.Equal(3m, line.Quantity);
    }

    private static PrescriptionDiagnosis Picked(
        Guid planId, Guid diagnosisId, int sortOrder = 0, params int[] teeth) =>
        new(Guid.NewGuid(), planId, diagnosisId, "DT01", "Viêm tủy", teeth, sortOrder);

    [Fact]
    public void Issue_Should_Keep_Picked_Diagnoses_And_Note()
    {
        var plan = Guid.NewGuid();
        var first = Picked(plan, Guid.NewGuid(), 0, 37, 36, 36);
        var second = Picked(plan, Guid.NewGuid(), 1);

        var prescription = Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, "DT26-0001", _staffId, [Line()],
            diagnoses: [second, first], diagnosisNote: "  Đau nhiều về đêm  ");

        Assert.Equal([first.Id, second.Id], prescription.Diagnoses.Select(d => d.Id).ToList());
        Assert.All(prescription.Diagnoses, d => Assert.Equal(prescription.Id, d.PrescriptionId));
        Assert.Equal("36,37", first.ToothCodes);
        Assert.Equal([36, 37], first.ToothCodeList());
        Assert.Empty(second.ToothCodeList());
        Assert.Equal("Đau nhiều về đêm", prescription.DiagnosisNote);
    }

    [Fact]
    public void Issue_Should_Reject_The_Same_Diagnosis_Of_A_Plan_Twice()
    {
        var plan = Guid.NewGuid();
        var diagnosis = Guid.NewGuid();

        var ex = Assert.Throws<BusinessException>(() => Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, "DT26-0001", _staffId, [Line()],
            diagnoses: [Picked(plan, diagnosis), Picked(plan, diagnosis, 1)]));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.DuplicatePrescriptionDiagnosis, ex.Code);
    }

    [Fact]
    public void Issue_Should_Allow_The_Same_Diagnosis_From_Two_Plans()
    {
        var diagnosis = Guid.NewGuid();

        var prescription = Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, "DT26-0001", _staffId, [Line()],
            diagnoses: [Picked(Guid.NewGuid(), diagnosis), Picked(Guid.NewGuid(), diagnosis, 1)]);

        Assert.Equal(2, prescription.Diagnoses.Count);
    }

    [Fact]
    public void UpdateDetails_Should_Replace_And_Clear_Diagnoses()
    {
        var prescription = Prescription.Issue(
            Guid.NewGuid(), _patientId, _branchId, "DT26-0001", _staffId, [Line()],
            diagnoses: [Picked(Guid.NewGuid(), Guid.NewGuid())], diagnosisNote: "x");

        prescription.UpdateDetails(
            _staffId, null, null, PrescriptionTreatmentType.Outpatient, null, [Line()]);

        Assert.Empty(prescription.Diagnoses);
        Assert.Null(prescription.DiagnosisNote);
    }

    [Fact]
    public void Diagnosis_Should_Require_Plan_And_Diagnosis()
    {
        var ex = Assert.Throws<BusinessException>(() => Picked(Guid.Empty, Guid.NewGuid()));

        Assert.Equal(BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionDiagnosisSourceInvalid, ex.Code);
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
            Guid.NewGuid(), Guid.NewGuid(), "  Paracetamol  ", 1m, 0m, 0m, 0m, 1, PrescriptionUsage.None, null, 0);

        Assert.Equal("Paracetamol", line.MedicationName);
    }
}
