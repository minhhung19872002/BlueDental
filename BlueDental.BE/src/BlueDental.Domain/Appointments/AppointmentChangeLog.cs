using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Appointments;

/// <summary>One line of an appointment's change history.</summary>
public sealed record AppointmentFieldChange(string Field, string? Before, string? After);

/// <summary>Who made a change, as the history remembers them.</summary>
public sealed record AppointmentChangeActor(
    Guid? UserId,
    string? Name,
    string? UserName,
    string? Role);

/// <summary>Where a change was made from.</summary>
public sealed record AppointmentChangeClient(
    AppointmentChangeSource Source,
    string? IpAddress,
    string? Browser,
    string? OperatingSystem,
    string? UserAgent);

/// <summary>
/// The stored shape of a change: the appointment before, the appointment
/// after, and the fields that differ between them.
/// </summary>
public sealed record AppointmentChangePayload(
    AppointmentSnapshot? Before,
    AppointmentSnapshot? After,
    IReadOnlyList<AppointmentFieldChange> Diff);

/// <summary>
/// Immutable record of one change to an appointment. It is written once,
/// next to the change itself, and never edited — so it is a plain entity
/// with its own timestamp rather than an audited one.
/// </summary>
public class AppointmentChangeLog : Entity<Guid>
{
    /// <summary>Fields whose change matters on its own ("thay đổi quan trọng").</summary>
    public static readonly IReadOnlySet<string> ImportantFields =
        new HashSet<string>(StringComparer.Ordinal) { "startTime", "toTime", "staffId", "status" };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public Guid AppointmentId { get; private set; }
    public Guid? PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public AppointmentChangeAction Action { get; private set; }
    public AppointmentChangeSource Source { get; private set; }
    public AppointmentStatus? StatusBefore { get; private set; }
    public AppointmentStatus? StatusAfter { get; private set; }

    /// <summary>Comma separated field names, e.g. "note,startTime".</summary>
    public string? ChangedFields { get; private set; }

    /// <summary>Serialized <see cref="AppointmentChangePayload"/>.</summary>
    public string ChangesJson { get; private set; } = "{}";

    public bool IsImportant { get; private set; }

    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }
    public string? ActorUserName { get; private set; }
    public string? ActorRole { get; private set; }

    public string? IpAddress { get; private set; }
    public string? Browser { get; private set; }
    public string? OperatingSystem { get; private set; }
    public string? UserAgent { get; private set; }

    public DateTime OccurredAt { get; private set; }

    private AppointmentChangeLog()
    {
    }

    public static AppointmentChangeLog Record(
        Guid id,
        AppointmentChangeAction action,
        Guid appointmentId,
        Guid? patientId,
        Guid branchId,
        AppointmentSnapshot? before,
        AppointmentSnapshot? after,
        AppointmentChangeActor actor,
        AppointmentChangeClient client,
        DateTime occurredAt)
    {
        Check.NotNull(actor, nameof(actor));
        Check.NotNull(client, nameof(client));

        if (before is null && after is null)
        {
            throw new ArgumentException("A change needs a snapshot before or after it.", nameof(after));
        }

        var diff = Diff(before, after);
        var touched = diff.Select(d => d.Field).ToList();
        // A creation changes nothing: every field is new, and the reference
        // leaves its "Thay đổi" column empty for such rows. The diff still
        // carries every field, so the detail can show what was set.
        var changed = action == AppointmentChangeAction.Created ? [] : touched;

        return new AppointmentChangeLog
        {
            Id = id,
            AppointmentId = appointmentId,
            PatientId = patientId,
            BranchId = branchId,
            Action = action,
            Source = client.Source,
            StatusBefore = before?.Status,
            StatusAfter = after?.Status,
            ChangedFields = changed.Count == 0 ? null : string.Join(',', changed),
            ChangesJson = JsonSerializer.Serialize(new AppointmentChangePayload(before, after, diff), JsonOptions),
            IsImportant = IsImportantChange(action, touched),
            ActorUserId = actor.UserId,
            ActorName = actor.Name,
            ActorUserName = actor.UserName,
            ActorRole = actor.Role,
            IpAddress = client.IpAddress,
            Browser = client.Browser,
            OperatingSystem = client.OperatingSystem,
            UserAgent = client.UserAgent,
            OccurredAt = occurredAt,
        };
    }

    /// <summary>
    /// The fields that differ between two snapshots. A creation or deletion
    /// has only one side, and then every populated field counts as changed.
    /// </summary>
    public static IReadOnlyList<AppointmentFieldChange> Diff(
        AppointmentSnapshot? before,
        AppointmentSnapshot? after)
    {
        var left = before?.Fields() ?? [];
        var right = after?.Fields() ?? [];
        var names = left.Select(f => f.Key).Concat(right.Select(f => f.Key)).Distinct();

        var changes = new List<AppointmentFieldChange>();
        foreach (var name in names)
        {
            var oldValue = left.FirstOrDefault(f => f.Key == name).Value;
            var newValue = right.FirstOrDefault(f => f.Key == name).Value;
            // A note that was never set and one saved back as "" are the same
            // thing; logging that as a change would be noise in every edit.
            if (!string.Equals(oldValue ?? "", newValue ?? "", StringComparison.Ordinal))
            {
                changes.Add(new AppointmentFieldChange(name, oldValue, newValue));
            }
        }

        return changes;
    }

    public static bool IsImportantChange(AppointmentChangeAction action, IEnumerable<string> changedFields)
    {
        if (action is AppointmentChangeAction.StatusChanged
            or AppointmentChangeAction.Cancelled
            or AppointmentChangeAction.Deleted)
        {
            return true;
        }

        return changedFields.Any(ImportantFields.Contains);
    }

    public AppointmentChangePayload ReadPayload()
    {
        return JsonSerializer.Deserialize<AppointmentChangePayload>(ChangesJson, JsonOptions)
               ?? new AppointmentChangePayload(null, null, []);
    }

    public IReadOnlyList<string> ChangedFieldList() =>
        string.IsNullOrEmpty(ChangedFields) ? [] : ChangedFields.Split(',');
}
