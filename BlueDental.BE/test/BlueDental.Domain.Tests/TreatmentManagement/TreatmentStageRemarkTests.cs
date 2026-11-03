using System;
using System.Linq;
using BlueDental.TreatmentManagement;
using BlueDental.TreatmentManagement.Values;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

/// <summary>
/// Ghi chú — the remark column of Lịch sử điều trị (owner, 2026-10-19). Kept
/// apart from the treatment content and, unlike it, still open once the công
/// đoạn is finished.
/// </summary>
public class TreatmentStageRemarkTests
{
    private readonly Guid _staffId = Guid.NewGuid();

    private TreatmentStage Stage() =>
        TreatmentStage.Add(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            1,
            "Niềng răng",
            _staffId,
            note: "Gắn mắc cài",
            teeth: new[] { 11, 12 }.Select(code => new ToothSelection(code, selected: true)));

    [Fact]
    public void A_remark_is_stored_apart_from_the_treatment_content()
    {
        var stage = Stage();

        stage.SetRemark("  BN hẹn tái khám sau 2 tuần  ");

        stage.Remark.ShouldBe("BN hẹn tái khám sau 2 tuần");
        stage.Note.ShouldBe("Gắn mắc cài");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_blank_remark_clears_it(string? blank)
    {
        var stage = Stage().SetRemark("có ghi chú");

        stage.SetRemark(blank);

        stage.Remark.ShouldBeNull();
    }

    [Fact]
    public void A_finished_stage_still_takes_a_remark()
    {
        var stage = Stage();
        stage.Complete();

        stage.SetRemark("Bổ sung sau khi hoàn thành");

        stage.Remark.ShouldBe("Bổ sung sau khi hoàn thành");
    }

    [Fact]
    public void A_continued_stage_still_takes_a_remark()
    {
        // BA 2026-11-02 "Cho phép chỉnh sửa hết": history rows too, logged instead.
        var stage = Stage();
        stage.ContinueAs(Guid.NewGuid(), 2, _staffId, "lần 2", null, null, null);

        stage.SetRemark("bổ sung");

        stage.Remark.ShouldBe("bổ sung");
    }

    [Fact]
    public void The_treatment_content_stays_open_on_finished_and_continued_rows()
    {
        var finished = Stage();
        finished.Complete();
        finished.SetNote("Sửa sau khi hoàn thành");
        finished.Note.ShouldBe("Sửa sau khi hoàn thành");

        var continued = Stage();
        continued.ContinueAs(Guid.NewGuid(), 2, _staffId, "lần 2", null, null, null);
        continued.SetNote("Sửa dòng lịch sử");
        continued.Note.ShouldBe("Sửa dòng lịch sử");

        continued.SetNote("  ");
        continued.Note.ShouldBeNull();
    }

    [Fact]
    public void A_remark_is_capped()
    {
        var stage = Stage();

        stage.SetRemark(new string('a', TreatmentStage.RemarkMaxLength));
        Should.Throw<ArgumentException>(
            () => stage.SetRemark(new string('a', TreatmentStage.RemarkMaxLength + 1)));
    }
}
