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
/// The rules behind "Chi tiết phiếu" as measured on staging 2026-09-24: a công
/// đoạn takes some of its line's teeth, "Tiếp tục" writes the next visit of the
/// chain and retires the old one, and a warranty is raised off a finished visit.
/// </summary>
public class StageChainAndWarrantyTests
{
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _branchId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _lineId = Guid.NewGuid();
    private readonly Guid _serviceId = Guid.NewGuid();
    private readonly Guid _staffId = Guid.NewGuid();
    private readonly StageTeethPolicy _policy = new();

    private static readonly DateTimeOffset Now = new(2026, 9, 24, 10, 0, 0, TimeSpan.Zero);

    private static List<ToothSelection> Teeth(params int[] codes) =>
        codes.Select(code => new ToothSelection(code, selected: true)).ToList();

    private TreatmentStage Stage(
        IEnumerable<ToothSelection> teeth,
        bool isGuarantee = false,
        Guid? warrantyRootStageId = null,
        int sequence = 1) =>
        TreatmentStage.Add(
            Guid.NewGuid(),
            _patientId,
            _branchId,
            _planId,
            _lineId,
            _serviceId,
            sequence,
            "Trồng răng",
            _staffId,
            note: "công đoạn",
            teeth: teeth,
            isGuarantee: isGuarantee,
            warrantyRootStageId: warrantyRootStageId);

    /// <summary>ABP stamps CreationTime on save; a unit test has to put it there itself.</summary>
    private static TreatmentStage WorkedOn(TreatmentStage stage, DateTimeOffset when)
    {
        typeof(TreatmentStage)
            .GetProperty(nameof(TreatmentStage.CreationTime))!
            .SetValue(stage, when.UtcDateTime);
        return stage;
    }

    [Fact]
    public void Continuing_writes_the_next_visit_and_retires_the_old_one()
    {
        var first = Stage(Teeth(13, 14));
        first.SetServiceItems([Guid.NewGuid()]);

        var nextStep = Guid.NewGuid();
        var next = first.ContinueAs(Guid.NewGuid(), 2, _staffId, "lần 2", null, null, [nextStep]);

        first.IsSuperseded.ShouldBeTrue();
        // The old one keeps its own status — staging returns it `created`.
        first.Status.ShouldBe(TreatmentStageStatus.Pending);

        next.IsSuperseded.ShouldBeFalse();
        next.ContinuedFromId.ShouldBe(first.Id);
        next.TreatmentServiceId.ShouldBe(first.TreatmentServiceId);
        next.Teeth.Select(t => t.ToothCode).ShouldBe([13, 14]);
        next.Note.ShouldBe("lần 2");
        next.ServiceItems.Select(i => i.CatalogServiceStageId).ShouldBe([nextStep]);

        // Equal teeth, but its own rows: EF will not let two công đoạn own one.
        next.Teeth.ShouldBe(first.Teeth);
        next.Teeth.Zip(first.Teeth).ShouldAllBe(pair => !ReferenceEquals(pair.First, pair.Second));
    }

    [Fact]
    public void A_warranty_continues_as_a_warranty_of_the_same_root()
    {
        var rootId = Guid.NewGuid();
        var warranty = Stage(Teeth(11, 21), isGuarantee: true, warrantyRootStageId: rootId);

        var next = warranty.ContinueAs(Guid.NewGuid(), 2, _staffId, "tiếp", null, null, null);

        next.IsGuarantee.ShouldBeTrue();
        next.WarrantyRootStageId.ShouldBe(rootId);
    }

    [Fact]
    public void A_superseded_visit_is_history()
    {
        var first = Stage(Teeth(13));
        first.ContinueAs(Guid.NewGuid(), 2, _staffId, "lần 2", null, null, null);

        foreach (var action in new Action[]
        {
            () => first.Complete(),
            () => first.ContinueAs(Guid.NewGuid(), 3, _staffId, "lần 3", null, null, null),
            () => first.UpdateServiceItems(new Dictionary<Guid, bool>(), Now, _staffId),
            () => first.UpdateDetails("x", "y", null, _staffId, null, null, null),
        })
        {
            Should.Throw<BusinessException>(action)
                .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
        }
    }

    [Fact]
    public void A_finished_visit_cannot_be_continued()
    {
        var stage = Stage(Teeth(13));
        stage.Complete();

        Should.Throw<BusinessException>(() =>
                stage.ContinueAs(Guid.NewGuid(), 2, _staffId, "lần 2", null, null, null))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidStageTransition);
    }

    [Fact]
    public void Only_a_warranty_remembers_its_root()
    {
        Stage(Teeth(13), isGuarantee: false, warrantyRootStageId: Guid.NewGuid())
            .WarrantyRootStageId.ShouldBeNull();
    }

    [Fact]
    public void Thêm_công_đoạn_takes_teeth_no_other_visit_holds()
    {
        var line = Teeth(21, 22, 23);
        var stages = new[] { Stage(Teeth(21, 23)) };

        _policy.EnsureNewStageTeeth(line, stages, Teeth(22));

        Should.Throw<BusinessException>(() => _policy.EnsureNewStageTeeth(line, stages, Teeth(22, 23)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StageToothAlreadyStaged);
        Should.Throw<BusinessException>(() => _policy.EnsureNewStageTeeth(line, stages, Teeth(24)))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StageToothOutsideService);
        Should.Throw<BusinessException>(() => _policy.EnsureNewStageTeeth(line, stages, []))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StageTeethRequired);
    }

    [Fact]
    public void A_visit_written_without_teeth_still_covers_the_whole_line()
    {
        var line = Teeth(21, 22);

        _policy.CoveredTeeth(line, [Stage([])]).OrderBy(code => code).ShouldBe([21, 22]);
    }

    [Fact]
    public void A_tooth_less_line_is_not_checked()
    {
        _policy.EnsureNewStageTeeth([], [Stage([])], []);
    }

    [Fact]
    public void A_warranty_picks_among_the_root_teeth()
    {
        var root = WorkedOn(Stage(Teeth(11, 21, 22)), Now.AddDays(-2));
        root.Complete();
        var line = Teeth(11, 21, 22, 32);

        _policy.EnsureWarranty(root, root, line, [root], Teeth(11, 21), 30, Now);

        // 32 is on the line, but the root never treated it.
        Should.Throw<BusinessException>(() =>
                _policy.EnsureWarranty(root, root, line, [root], Teeth(11, 32), 30, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.StageToothOutsideService);
    }

    [Fact]
    public void A_warranty_off_a_warranty_still_offers_the_root_teeth()
    {
        var root = WorkedOn(Stage(Teeth(11, 21, 22, 32)), Now.AddDays(-3));
        root.Complete();
        var first = WorkedOn(
            Stage(Teeth(11, 21, 22), isGuarantee: true, warrantyRootStageId: root.Id),
            Now.AddDays(-1));
        first.Complete();

        // The first warranty took 11·21·22; the next one may go back to 32.
        _policy.EnsureWarranty(first, root, Teeth(11, 21, 22, 32), [root, first], Teeth(11, 32), 30, Now);
    }

    [Fact]
    public void An_open_warranty_blocks_the_next_one()
    {
        var root = WorkedOn(Stage(Teeth(11, 21)), Now.AddDays(-1));
        root.Complete();
        var open = Stage(Teeth(11), isGuarantee: true, warrantyRootStageId: root.Id);

        Should.Throw<BusinessException>(() =>
                _policy.EnsureWarranty(root, root, Teeth(11, 21), [root, open], Teeth(11), 30, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.OpenWarrantyMustComplete);

        // A superseded warranty is not open: its successor carries it.
        var superseded = Stage(Teeth(21), isGuarantee: true, warrantyRootStageId: root.Id);
        var successor = superseded.ContinueAs(Guid.NewGuid(), 2, _staffId, "tiếp", null, null, null);
        successor.Complete();
        _policy.EnsureWarranty(root, root, Teeth(11, 21), [root, superseded, successor], Teeth(21), 30, Now);
    }

    [Fact]
    public void A_warranty_needs_a_finished_live_source_a_period_and_time_left()
    {
        var line = Teeth(11);
        var open = WorkedOn(Stage(Teeth(11)), Now);
        Should.Throw<BusinessException>(() =>
                _policy.EnsureWarranty(open, open, line, [open], Teeth(11), 30, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantySourceInvalid);

        var done = WorkedOn(Stage(Teeth(11)), Now.AddDays(-10));
        done.Complete();
        Should.Throw<BusinessException>(() =>
                _policy.EnsureWarranty(done, done, line, [done], Teeth(11), 0, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.ServiceHasNoWarranty);
        Should.Throw<BusinessException>(() =>
                _policy.EnsureWarranty(done, done, line, [done], Teeth(11), 10, Now))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyExpired);
    }

    [Fact]
    public void Warranty_days_count_calendar_days_like_the_reference()
    {
        // getWarrantyDaysRemaining: period − whole days between the two dates.
        StageTeethPolicy.WarrantyDaysLeft(30, Now.UtcDateTime, Now).ShouldBe(30);
        StageTeethPolicy.WarrantyDaysLeft(30, Now.AddDays(-29).UtcDateTime, Now).ShouldBe(1);
        StageTeethPolicy.WarrantyDaysLeft(30, Now.AddDays(-30).UtcDateTime, Now).ShouldBe(0);
    }
}
