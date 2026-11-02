using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Turns a stored change-log row into what "Lịch sử chỉnh sửa" shows: field by
/// field, before and after, staff and steps by name. The log keeps the raw text
/// (<see cref="TreatmentStageChangeRecorder"/>); reading it is done here.
/// </summary>
public static class TreatmentStageChangeDescriber
{
    private const string DateFormat = "dd/MM/yyyy";

    /// <summary>The staff and catalog steps a row names by id, to be looked up once for a whole log.</summary>
    public static IEnumerable<Guid> ReferencedIds(TreatmentStageChangeLog log) => log.Action switch
    {
        TreatmentStageChangeAction.DetailsUpdated or TreatmentStageChangeAction.Deleted =>
            new[] { Parse(log.Before), Parse(log.After) }
                .Where(snapshot => snapshot is not null)
                .SelectMany(snapshot => new[] { snapshot!.StaffId, snapshot.SecondStaffId, snapshot.SubStaffId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value),
        TreatmentStageChangeAction.ServiceItemsUpdated => Ids(log.Before).Concat(Ids(log.After)),
        _ => [],
    };

    public static List<TreatmentStageChangeFieldDto> Describe(
        TreatmentStageChangeLog log,
        IReadOnlyDictionary<Guid, string> names) => log.Action switch
    {
        TreatmentStageChangeAction.NoteChanged => [Field("Note", log.Before, log.After)],
        TreatmentStageChangeAction.RemarkChanged => [Field("Remark", log.Before, log.After)],
        TreatmentStageChangeAction.ImageAdded or TreatmentStageChangeAction.ImageRemoved =>
            [Field("Image", Picture(log.Before), Picture(log.After))],
        TreatmentStageChangeAction.ServiceItemsUpdated =>
            [Field("Steps", StepNames(log.Before, names), StepNames(log.After, names))],
        TreatmentStageChangeAction.DetailsUpdated => Compare(Parse(log.Before), Parse(log.After), names),
        // The row as it stood when it went: every field it had, nothing after.
        TreatmentStageChangeAction.Deleted => Compare(Parse(log.Before), null, names),
        _ => [],
    };

    private static List<TreatmentStageChangeFieldDto> Compare(
        Snapshot? before,
        Snapshot? after,
        IReadOnlyDictionary<Guid, string> names)
    {
        string? Name(Guid? id) => id is { } value ? names.GetValueOrDefault(value) ?? value.ToString() : null;

        var fields = new[]
        {
            Field("TreatmentDate", Date(before?.TreatmentDate), Date(after?.TreatmentDate)),
            Field("Name", before?.Name, after?.Name),
            Field("Teeth", Teeth(before?.Teeth), Teeth(after?.Teeth)),
            Field("Note", before?.Note, after?.Note),
            Field("Remark", before?.Remark, after?.Remark),
            Field("Staff", Name(before?.StaffId), Name(after?.StaffId)),
            Field("SecondStaff", Name(before?.SecondStaffId), Name(after?.SecondStaffId)),
            Field("SubStaff", Name(before?.SubStaffId), Name(after?.SubStaffId)),
            Field("ScheduledDate", Date(before?.ScheduledDate), Date(after?.ScheduledDate)),
        };

        return fields
            .Where(f => !string.Equals(f.Before ?? "", f.After ?? "", StringComparison.Ordinal))
            .ToList();
    }

    private static TreatmentStageChangeFieldDto Field(string field, string? before, string? after) =>
        new() { Field = field, Before = Blank(before), After = Blank(after) };

    private static string? Blank(string? text) => string.IsNullOrWhiteSpace(text) ? null : text;

    private static string? Date(DateOnly? date) => date?.ToString(DateFormat, CultureInfo.InvariantCulture);

    private static string? Teeth(List<int>? teeth) => teeth is { Count: > 0 } ? string.Join(", ", teeth) : null;

    /// <summary>"{imageId} {fileName}" from Tải ảnh, or a link from the older attach call: the name either way.</summary>
    private static string? Picture(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var space = text.IndexOf(' ');
        if (space > 0 && Guid.TryParse(text[..space], out _)) return text[(space + 1)..];
        var slash = text.LastIndexOf('/');
        return slash >= 0 && slash < text.Length - 1 ? text[(slash + 1)..] : text;
    }

    private static string? StepNames(string? ids, IReadOnlyDictionary<Guid, string> names)
    {
        var named = Ids(ids).Select(id => names.GetValueOrDefault(id) ?? id.ToString()).ToList();
        return named.Count > 0 ? string.Join(", ", named) : null;
    }

    private static IEnumerable<Guid> Ids(string? text) => (text ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(part => Guid.TryParse(part, out var id) ? id : (Guid?)null)
        .Where(id => id.HasValue)
        .Select(id => id!.Value);

    private static Snapshot? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<Snapshot>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>The shape <see cref="TreatmentStageChangeRecorder.Snapshot"/> writes.</summary>
    private sealed class Snapshot
    {
        public string? Name { get; set; }
        public string? Note { get; set; }
        public string? Remark { get; set; }
        public Guid? StaffId { get; set; }
        public Guid? SecondStaffId { get; set; }
        public Guid? SubStaffId { get; set; }
        public DateOnly? ScheduledDate { get; set; }
        public DateOnly? TreatmentDate { get; set; }
        public List<int>? Teeth { get; set; }
    }
}
