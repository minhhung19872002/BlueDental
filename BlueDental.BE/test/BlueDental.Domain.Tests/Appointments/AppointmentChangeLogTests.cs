using System;
using System.Linq;
using Xunit;

namespace BlueDental.Appointments;

public class AppointmentChangeLogTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 5, 9, 0, 0, TimeSpan.FromHours(7));

    private static readonly AppointmentChangeActor Actor = new(Guid.NewGuid(), "Lê Tân", "letan", "receptionist");
    private static readonly AppointmentChangeClient Client =
        new(AppointmentChangeSource.Web, "127.0.0.1", "Chrome 128", "Windows 10", "Mozilla/5.0");

    private static AppointmentSnapshot Snapshot(
        AppointmentStatus status = AppointmentStatus.Requested,
        string? note = "ghi chú",
        DateTimeOffset? start = null,
        Guid? staffId = null,
        string? staffName = "BS. A")
    {
        var from = start ?? Start;
        return new AppointmentSnapshot(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            from,
            from.AddMinutes(30),
            30,
            status,
            note,
            "Khám định kỳ",
            "#1E5BB0",
            staffId ?? Guid.Parse("22222222-2222-2222-2222-222222222222"),
            staffName,
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Guid.Parse("44444444-4444-4444-4444-444444444444"),
            "Nguyễn Văn Thử",
            "0900000000",
            null,
            null,
            false);
    }

    [Fact]
    public void Diff_Lists_Only_The_Fields_That_Changed()
    {
        var before = Snapshot(note: "hgh");
        var after = Snapshot(note: "hgh1");

        var diff = AppointmentChangeLog.Diff(before, after);

        var change = Assert.Single(diff);
        Assert.Equal("note", change.Field);
        Assert.Equal("hgh", change.Before);
        Assert.Equal("hgh1", change.After);
    }

    [Fact]
    public void Diff_Treats_A_Missing_Value_And_An_Empty_One_As_The_Same()
    {
        var diff = AppointmentChangeLog.Diff(Snapshot(note: null), Snapshot(note: ""));

        Assert.Empty(diff);
    }

    [Fact]
    public void Diff_Of_A_Creation_Lists_Every_Populated_Field()
    {
        var diff = AppointmentChangeLog.Diff(null, Snapshot());

        // The reference lists "+ id · + startTime · + toTime" for a creation.
        Assert.Equal(new[] { "id", "startTime", "toTime" }, diff.Take(3).Select(d => d.Field).ToArray());
        Assert.Contains(diff, d => d.Field == "startTime" && d.Before is null && d.After is not null);
        Assert.Contains(diff, d => d.Field == "status" && d.After == "Requested");
        Assert.DoesNotContain(diff, d => d.Field == "cancelReason");
    }

    [Fact]
    public void Diff_Shows_Doctor_By_Name_Not_Id()
    {
        var before = Snapshot(staffId: Guid.NewGuid(), staffName: "BS. A");
        var after = Snapshot(staffId: Guid.NewGuid(), staffName: "BS. B");

        var change = Assert.Single(AppointmentChangeLog.Diff(before, after));
        Assert.Equal("staffId", change.Field);
        Assert.Equal("BS. A", change.Before);
        Assert.Equal("BS. B", change.After);
    }

    [Fact]
    public void A_Note_Edit_Is_Not_Important()
    {
        var log = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.Updated,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Snapshot(note: "a"), Snapshot(note: "b"), Actor, Client, DateTime.UtcNow);

        Assert.False(log.IsImportant);
        Assert.Equal("note", log.ChangedFields);
    }

    [Fact]
    public void A_Creation_Has_No_Changed_Fields_But_Keeps_The_Full_Diff_And_Is_Important()
    {
        var log = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.Created,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            null, Snapshot(note: "a"), Actor, Client, DateTime.UtcNow);

        Assert.Null(log.ChangedFields);
        Assert.Empty(log.ChangedFieldList());
        Assert.True(log.IsImportant);
        Assert.Contains(log.ReadPayload().Diff, d => d.Field == "startTime");
    }

    [Theory]
    [InlineData(AppointmentChangeAction.StatusChanged)]
    [InlineData(AppointmentChangeAction.Cancelled)]
    [InlineData(AppointmentChangeAction.Deleted)]
    public void Status_Cancel_And_Delete_Are_Always_Important(AppointmentChangeAction action)
    {
        var log = AppointmentChangeLog.Record(
            Guid.NewGuid(), action,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Snapshot(), action == AppointmentChangeAction.Deleted ? null : Snapshot(),
            Actor, Client, DateTime.UtcNow);

        Assert.True(log.IsImportant);
    }

    [Fact]
    public void Moving_The_Time_Or_The_Doctor_Is_Important()
    {
        var moved = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.Updated,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Snapshot(), Snapshot(start: Start.AddHours(1)), Actor, Client, DateTime.UtcNow);
        Assert.True(moved.IsImportant);

        var reassigned = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.Updated,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Snapshot(), Snapshot(staffId: Guid.NewGuid(), staffName: "BS. B"), Actor, Client, DateTime.UtcNow);
        Assert.True(reassigned.IsImportant);
    }

    [Fact]
    public void Record_Keeps_Both_Statuses_And_Who_Did_It()
    {
        var at = new DateTime(2026, 9, 5, 3, 36, 6, DateTimeKind.Utc);
        var log = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.StatusChanged,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            Snapshot(AppointmentStatus.Confirmed), Snapshot(AppointmentStatus.NoShow),
            Actor, Client, at);

        Assert.Equal(AppointmentStatus.Confirmed, log.StatusBefore);
        Assert.Equal(AppointmentStatus.NoShow, log.StatusAfter);
        Assert.Equal("Lê Tân", log.ActorName);
        Assert.Equal("letan", log.ActorUserName);
        Assert.Equal(AppointmentChangeSource.Web, log.Source);
        Assert.Equal("Chrome 128", log.Browser);
        Assert.Equal(at, log.OccurredAt);
    }

    [Fact]
    public void Payload_Round_Trips_Through_Json()
    {
        var before = Snapshot(AppointmentStatus.Confirmed, note: "x");
        var after = Snapshot(AppointmentStatus.NoShow, note: "y");
        var log = AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.StatusChanged,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            before, after, Actor, Client, DateTime.UtcNow);

        var payload = log.ReadPayload();

        Assert.Equal(before, payload.Before);
        Assert.Equal(after, payload.After);
        Assert.Equal(new[] { "status", "note" }, payload.Diff.Select(d => d.Field).ToArray());
        Assert.Equal(new[] { "status", "note" }, log.ChangedFieldList());
    }

    [Fact]
    public void Record_Refuses_A_Change_With_No_Snapshot_At_All()
    {
        Assert.Throws<ArgumentException>(() => AppointmentChangeLog.Record(
            Guid.NewGuid(), AppointmentChangeAction.Updated,
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            null, null, Actor, Client, DateTime.UtcNow));
    }
}
