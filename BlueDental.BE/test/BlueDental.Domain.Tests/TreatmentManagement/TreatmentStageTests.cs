using System;
using System.Collections.Generic;
using System.Linq;
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
    public void A_completed_step_can_be_re_opened()
    {
        // The reference un-ticks its Hoàn thành box through revert-status, so
        // completion is not final.
        var stage = CreateStage();
        stage.Complete();

        stage.Revert();

        stage.Status.ShouldBe(TreatmentStageStatus.InProgress);
        stage.CompletedAt.ShouldBeNull();
        // The visit still happened, so the start is left standing.
        stage.StartedAt.ShouldNotBeNull();
    }

    [Fact]
    public void Re_opening_a_step_that_was_never_finished_is_refused()
    {
        var stage = CreateStage();

        Should.Throw<BusinessException>(() => stage.Revert())
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);

        stage.Status.ShouldBe(TreatmentStageStatus.Pending);
    }

    [Fact]
    public void A_re_opened_step_can_be_finished_again()
    {
        var stage = CreateStage();
        stage.Complete();
        stage.Revert();

        stage.Complete();

        stage.Status.ShouldBe(TreatmentStageStatus.Completed);
        stage.CompletedAt.ShouldNotBeNull();
    }

    /// <summary>
    /// The image flag records the catalog's setting; it does not gate Hoàn thành.
    /// This test is the inverse of the one it replaces: the original assumed a
    /// service carrying "Yêu cầu hình ảnh khi điều trị" would refuse completion,
    /// and the reference was then seen to close a công đoạn with no image at all.
    /// </summary>
    [Fact]
    public void A_service_that_requires_an_image_still_completes_without_one()
    {
        var stage = CreateStage(isImageRequired: true);

        stage.Complete();

        stage.Status.ShouldBe(TreatmentStageStatus.Completed);
        stage.CompletedAt.ShouldNotBeNull();
        stage.ImageUrls.ShouldBeEmpty();
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
                stage.UpdateDetails("Khác", null, null, _staffId, null, null, null))
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

    [Fact]
    public void A_stage_keeps_both_helper_slots_apart()
    {
        // The reference stores them separately: assistantStaffId is the second
        // dentist (Bác sĩ hỗ trợ) and subStaffId the nurse (Phụ tá). The history
        // row prints both, so neither may swallow the other.
        var secondDentist = Guid.NewGuid();
        var nurse = Guid.NewGuid();

        var stage = TreatmentStage.Add(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _treatmentId,
            _treatmentServiceId,
            _serviceId,
            1,
            "Gắn mắc cài hàm trên",
            _staffId,
            secondStaffId: secondDentist,
            subStaffId: nurse);

        stage.SecondStaffId.ShouldBe(secondDentist);
        stage.SubStaffId.ShouldBe(nurse);
    }

    [Fact]
    public void Editing_a_stage_can_clear_a_helper_slot()
    {
        var stage = TreatmentStage.Add(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _treatmentId,
            _treatmentServiceId,
            _serviceId,
            1,
            "Gắn mắc cài hàm trên",
            _staffId,
            secondStaffId: Guid.NewGuid(),
            subStaffId: Guid.NewGuid());

        stage.UpdateDetails("Gắn mắc cài hàm trên", "Ghi chú mới", null, _staffId, null, null, null);

        stage.Note.ShouldBe("Ghi chú mới");
        stage.SecondStaffId.ShouldBeNull();
        stage.SubStaffId.ShouldBeNull();
    }

    [Fact]
    public void A_stage_records_that_a_follow_up_was_raised_from_it()
    {
        // The reference flips hasReExamination on the source công đoạn; the
        // follow-up itself lives in its own row.
        var stage = CreateStage();
        stage.HasReExamination.ShouldBeFalse();

        stage.MarkReExamined();
        stage.MarkReExamined();

        stage.HasReExamination.ShouldBeTrue();
    }

    // ── "Danh sách công đoạn" — the service's own steps, ticked off per row ──

    private static readonly Guid StepA = Guid.NewGuid();
    private static readonly Guid StepB = Guid.NewGuid();

    [Fact]
    public void The_steps_a_stage_covers_are_chosen_when_it_is_created_and_start_unticked()
    {
        var stage = TreatmentStage.Add(
            Guid.NewGuid(), _patientId, _branchId, _treatmentId, _treatmentServiceId,
            _serviceId, 1, "Gắn mắc cài", _staffId, serviceItemIds: [StepA, StepB]);

        stage.ServiceItems.Count.ShouldBe(2);
        stage.ServiceItems.ShouldAllBe(item => !item.IsCompleted);
        stage.ServiceItems.ShouldAllBe(item => item.CompletedAt == null);
    }

    [Fact]
    public void The_same_step_is_not_taken_twice()
    {
        var stage = TreatmentStage.Add(
            Guid.NewGuid(), _patientId, _branchId, _treatmentId, _treatmentServiceId,
            _serviceId, 1, "Gắn mắc cài", _staffId, serviceItemIds: [StepA, StepA]);

        stage.ServiceItems.ShouldHaveSingleItem();
    }

    [Fact]
    public void Ticking_a_step_stamps_who_and_when_and_unticking_clears_both()
    {
        var stage = CreateStage().SetServiceItems([StepA, StepB]);
        var now = DateTimeOffset.UtcNow;

        stage.UpdateServiceItems(new Dictionary<Guid, bool> { [StepA] = true }, now, _staffId);

        var ticked = stage.ServiceItems.Single(x => x.CatalogServiceStageId == StepA);
        ticked.IsCompleted.ShouldBeTrue();
        ticked.CompletedAt.ShouldBe(now);
        ticked.StaffId.ShouldBe(_staffId);

        // Anything left out of the call is unticked: one call is the whole picture,
        // which is what lets the history row's checkbox turn both ways.
        stage.ServiceItems.Single(x => x.CatalogServiceStageId == StepB).IsCompleted.ShouldBeFalse();

        stage.UpdateServiceItems(new Dictionary<Guid, bool> { [StepA] = false }, now, _staffId);

        var cleared = stage.ServiceItems.Single(x => x.CatalogServiceStageId == StepA);
        cleared.IsCompleted.ShouldBeFalse();
        cleared.CompletedAt.ShouldBeNull();
        cleared.StaffId.ShouldBeNull();
    }

    [Fact]
    public void A_step_the_stage_does_not_cover_cannot_be_ticked()
    {
        var stage = CreateStage().SetServiceItems([StepA]);

        Should.Throw<BusinessException>(() => stage.UpdateServiceItems(
                new Dictionary<Guid, bool> { [StepB] = true }, DateTimeOffset.UtcNow, _staffId))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.UnknownStageServiceItem);
    }

    [Fact]
    public void Ticking_the_same_step_twice_keeps_the_first_time()
    {
        var stage = CreateStage().SetServiceItems([StepA]);
        var first = DateTimeOffset.UtcNow;

        stage.UpdateServiceItems(new Dictionary<Guid, bool> { [StepA] = true }, first, _staffId);
        stage.UpdateServiceItems(
            new Dictionary<Guid, bool> { [StepA] = true }, first.AddHours(1), Guid.NewGuid());

        stage.ServiceItems.Single().CompletedAt.ShouldBe(first);
        stage.ServiceItems.Single().StaffId.ShouldBe(_staffId);
    }
}
