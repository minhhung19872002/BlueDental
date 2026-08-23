using System;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class TreatmentStageTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _treatmentId = Guid.NewGuid();
    private readonly Guid _treatmentServiceId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();

    private TreatmentStage CreateStage(int sequenceNumber = 1, bool isImageRequired = false)
    {
        return TreatmentStage.Add(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _treatmentId,
            _treatmentServiceId,
            _serviceId,
            sequenceNumber,
            "Gắn mắc cài hàm trên",
            _staffId,
            note: "Chụp phim trước khi gắn",
            isImageRequired: isImageRequired);
    }

    [Fact]
    public void A_new_stage_is_pending_and_has_not_started()
    {
        var stage = CreateStage();

        stage.Status.ShouldBe(TreatmentStageStatus.Pending);
        stage.StartedAt.ShouldBeNull();
        stage.CompletedAt.ShouldBeNull();
    }

    [Fact]
    public void A_stage_is_numbered_from_one()
    {
        Should.Throw<BusinessException>(() => CreateStage(sequenceNumber: 0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageSequence);
    }

    [Fact]
    public void Continuing_a_stage_starts_it_once_and_keeps_the_first_start_time()
    {
        var stage = CreateStage();

        stage.Continue();
        var firstStart = stage.StartedAt;

        stage.Continue();

        stage.Status.ShouldBe(TreatmentStageStatus.InProgress);
        stage.StartedAt.ShouldBe(firstStart);
    }

    [Fact]
    public void A_stage_can_be_completed_straight_from_pending()
    {
        // continue and complete are separate abilities on the reference, so holding
        // only complete must still be enough to close a step.
        var stage = CreateStage();

        stage.Complete();

        stage.Status.ShouldBe(TreatmentStageStatus.Completed);
        stage.StartedAt.ShouldNotBeNull();
        stage.CompletedAt.ShouldNotBeNull();
    }

    [Fact]
    public void A_service_that_requires_an_image_refuses_completion_without_one()
    {
        var stage = CreateStage(isImageRequired: true);

        Should.Throw<BusinessException>(() => stage.Complete())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StageImageRequired);

        stage.AttachImage("https://files.local/xray-1.png");
        stage.Complete();

        stage.Status.ShouldBe(TreatmentStageStatus.Completed);
    }

    [Fact]
    public void The_same_image_is_never_attached_twice()
    {
        var stage = CreateStage();

        stage.AttachImage("https://files.local/xray-1.png");
        stage.AttachImage("https://files.local/xray-1.png");

        stage.ImageUrls.Count.ShouldBe(1);
    }

    [Fact]
    public void A_completed_stage_is_frozen()
    {
        var stage = CreateStage();
        stage.Complete();

        Should.Throw<BusinessException>(() => stage.Continue())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
        Should.Throw<BusinessException>(() => stage.Complete())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
        Should.Throw<BusinessException>(() =>
                stage.UpdateDetails("Khác", null, null, _staffId, null, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
        Should.Throw<BusinessException>(() => stage.AttachImage("https://files.local/xray-2.png"))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
    }

    [Fact]
    public void A_stage_refuses_the_same_tooth_twice()
    {
        Should.Throw<BusinessException>(() => TreatmentStage.Add(
                Guid.NewGuid(),
                _patientId,
                _branchId,
                _treatmentId,
                _treatmentServiceId,
                _serviceId,
                1,
                "Trám răng",
                _staffId,
                teeth:
                [
                    new ToothSelection(36, selected: true),
                    new ToothSelection(36, top: true)
                ]))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.DuplicateToothSelection);
    }

    [Fact]
    public void A_stage_may_target_no_tooth_at_all()
    {
        // Unlike a diagnosis, not every step is tooth-specific (e.g. taking a pano).
        var stage = CreateStage();

        stage.Teeth.ShouldBeEmpty();
    }
}
