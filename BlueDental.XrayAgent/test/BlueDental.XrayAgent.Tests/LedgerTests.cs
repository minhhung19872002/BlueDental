using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

public sealed class LedgerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 8, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 15)]
    [InlineData(3, 60)]
    [InlineData(4, 300)]
    [InlineData(5, 900)]
    [InlineData(40, 900)]
    public void Backoff_grows_then_stays_at_fifteen_minutes(int failures, int seconds)
    {
        Backoff.After(failures).ShouldBe(TimeSpan.FromSeconds(seconds));
    }

    [Fact]
    public void Failures_count_up_and_set_the_next_attempt()
    {
        var ledger = UploadLedger.Load(null, Now);

        ledger.MarkFailed("k", Now, "x");
        var wait = ledger.MarkFailed("k", Now, "x");

        wait.ShouldBe(TimeSpan.FromSeconds(15));
        ledger.Find("k")!.Failures.ShouldBe(2);
        ledger.NextAttempt("k").ShouldBe(Now + TimeSpan.FromSeconds(15));
        ledger.IsFinished("k").ShouldBeFalse();
    }

    [Fact]
    public void Sent_and_rejected_are_finished()
    {
        var ledger = UploadLedger.Load(null, Now);

        ledger.MarkSent("a", Now, "ok");
        ledger.MarkRejected("b", Now, "BlueDental:Imaging:0003");

        ledger.IsFinished("a").ShouldBeTrue();
        ledger.IsFinished("b").ShouldBeTrue();
    }

    [Fact]
    public void Persists_and_prunes_entries_older_than_a_year()
    {
        using var temp = new TempFolder();
        var path = Path.Combine(temp.Path, "state.json");
        var ledger = UploadLedger.Load(path, Now);
        ledger.MarkSent("old", Now.AddDays(-400), "ok");
        ledger.MarkSent("new", Now, "ok");

        var reloaded = UploadLedger.Load(path, Now);

        reloaded.Count.ShouldBe(1);
        reloaded.IsFinished("new").ShouldBeTrue();
    }

    [Fact]
    public void A_damaged_file_is_moved_aside()
    {
        using var temp = new TempFolder();
        var path = temp.Write("state.json", "{not json"u8.ToArray());

        var ledger = UploadLedger.Load(path, Now);

        ledger.Count.ShouldBe(0);
        File.Exists(path + ".bad").ShouldBeTrue();
    }

    [Fact]
    public void Fingerprint_hides_the_path_and_changes_with_the_file()
    {
        var when = new DateTime(2026, 11, 11, 1, 0, 0, DateTimeKind.Utc);
        var key = UploadLedger.Fingerprint(@"C:\X\Tran Van B.jpg", 100, when);

        key.ShouldNotContain("Tran");
        key.ShouldBe(UploadLedger.Fingerprint(@"c:\x\tran van b.jpg", 100, when));
        key.ShouldNotBe(UploadLedger.Fingerprint(@"C:\X\Tran Van B.jpg", 101, when));
    }
}
