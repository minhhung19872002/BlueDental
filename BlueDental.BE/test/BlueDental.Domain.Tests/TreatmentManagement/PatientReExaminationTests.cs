using System;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// Tái khám is a row of its own, not another công đoạn — see
/// <see cref="PatientReExamination"/> for the reference's timeline shape.
/// </summary>
public class PatientReExaminationTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _stageId = Guid.NewGuid();
    private readonly Guid _treatmentServiceId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private PatientReExamination Raise(params ToothSelection[] teeth)
    {
        return PatientReExamination.Raise(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            "REX001",
            _stageId,
            _treatmentServiceId,
            _serviceId,
            _staffId,
            note: "Tái khám sau 1 tuần",
            teeth: teeth.Length > 0 ? teeth : new[] { new ToothSelection(38, selected: true) });
    }

    [Fact]
    public void A_follow_up_keeps_the_stage_it_came_from_and_the_teeth_chosen()
    {
        var visit = Raise();

        visit.Code.ShouldBe("REX001");
        visit.PatientStageId.ShouldBe(_stageId);
        visit.TreatmentServiceId.ShouldBe(_treatmentServiceId);
        visit.Teeth.ShouldHaveSingleItem().ToothCode.ShouldBe(38);
        visit.ImageUrls.ShouldBeEmpty();
    }

    [Fact]
    public void A_follow_up_needs_at_least_one_tooth_chosen()
    {
        // The form opens with none ticked, so an empty submit has to be refused
        // rather than quietly standing in for "all of the source stage's teeth".
        Should.Throw<BusinessException>(() => PatientReExamination.Raise(
                Guid.NewGuid(), _patientId, _branchId, "REX001", _stageId,
                _treatmentServiceId, _serviceId, _staffId, teeth: Array.Empty<ToothSelection>()))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.EmptyToothSelection);
    }

    [Fact]
    public void The_same_tooth_cannot_be_chosen_twice()
    {
        Should.Throw<BusinessException>(() => Raise(
                new ToothSelection(38, selected: true),
                new ToothSelection(38, selected: true)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.DuplicateToothSelection);
    }

    [Fact]
    public void A_follow_up_needs_a_code()
    {
        Should.Throw<ArgumentException>(() => PatientReExamination.Raise(
            Guid.NewGuid(), _patientId, _branchId, "  ", _stageId,
            _treatmentServiceId, _serviceId, _staffId,
            teeth: new[] { new ToothSelection(38, selected: true) }));
    }

    [Fact]
    public void Pictures_are_kept_in_order_and_never_twice()
    {
        var visit = Raise();

        visit.AttachImage("http://minio/rex/a.png");
        visit.AttachImage("http://minio/rex/b.png");
        visit.AttachImage("  http://minio/rex/a.png  ");

        visit.ImageUrls.ShouldBe(new[] { "http://minio/rex/a.png", "http://minio/rex/b.png" });
    }

    [Fact]
    public void An_empty_picture_url_is_refused()
    {
        Should.Throw<ArgumentException>(() => Raise().AttachImage(" "));
    }
}
