using System;
using System.Collections.Generic;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class PatientDiagnosisTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _diagnosisId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private PatientDiagnosis CreateDiagnosis(params ToothSelection[] teeth)
    {
        return PatientDiagnosis.Record(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _diagnosisId,
            _staffId,
            "CD26-0001",
            teeth.Length > 0 ? teeth : new[] { new ToothSelection(36, selected: true) },
            note: "Sâu răng mặt nhai");
    }

    [Fact]
    public void Should_Record_Diagnosis_As_Created()
    {
        var diagnosis = CreateDiagnosis();

        Assert.Equal(PatientDiagnosisStatus.Created, diagnosis.Status);
        Assert.False(diagnosis.HasTreatmentService);
        Assert.Single(diagnosis.Teeth);
        Assert.Equal("CD26-0001", diagnosis.Code);
    }

    [Fact]
    public void Should_Require_At_Least_One_Tooth()
    {
        Assert.Throws<BusinessException>(() => PatientDiagnosis.Record(
            Guid.NewGuid(), _patientId, _branchId, _diagnosisId, _staffId,
            "CD26-0002", new List<ToothSelection>()));
    }

    [Fact]
    public void Should_Reject_Duplicate_Teeth()
    {
        Assert.Throws<BusinessException>(() => CreateDiagnosis(
            new ToothSelection(36, selected: true),
            new ToothSelection(36, top: true)));
    }

    [Fact]
    public void Should_Move_To_InProgress_When_Treatment_Service_Created()
    {
        var diagnosis = CreateDiagnosis();

        diagnosis.MarkTreatmentServiceCreated();

        Assert.True(diagnosis.HasTreatmentService);
        Assert.Equal(PatientDiagnosisStatus.InProgress, diagnosis.Status);
    }

    [Fact]
    public void Should_Not_Cancel_A_Treated_Diagnosis()
    {
        var diagnosis = CreateDiagnosis();
        diagnosis.MarkTreated();

        Assert.Throws<BusinessException>(() => diagnosis.Cancel());
    }

    [Fact]
    public void Should_Not_Mark_A_Cancelled_Diagnosis_As_Treated()
    {
        var diagnosis = CreateDiagnosis();
        diagnosis.Cancel();

        Assert.Throws<BusinessException>(() => diagnosis.MarkTreated());
    }

    [Fact]
    public void Should_Not_Edit_A_Treated_Diagnosis()
    {
        var diagnosis = CreateDiagnosis();
        diagnosis.MarkTreated();

        Assert.Throws<BusinessException>(() =>
            diagnosis.UpdateTeeth(new[] { new ToothSelection(37, selected: true) }));
        Assert.Throws<BusinessException>(() => diagnosis.UpdateNote("x"));
    }

    [Fact]
    public void Should_Replace_Teeth_While_Editable()
    {
        var diagnosis = CreateDiagnosis();

        diagnosis.UpdateTeeth(new[]
        {
            new ToothSelection(37, top: true),
            new ToothSelection(38, selected: true)
        });

        Assert.Equal(2, diagnosis.Teeth.Count);
    }
}
