using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BlueDental.XrayAgent.Core;

/// <summary>Waits between failed sends of one picture: 5 s, 15 s, 1 min, 5 min, then every 15 min.</summary>
public static class Backoff
{
    private static readonly TimeSpan[] Steps =
    [
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(15),
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
    ];

    public static TimeSpan After(int failures) => Steps[Math.Clamp(failures - 1, 0, Steps.Length - 1)];
}

public enum LedgerState
{
    Retrying,
    Sent,
    Rejected,
}

public sealed class LedgerEntry
{
    public LedgerState State { get; set; }
    public int Failures { get; set; }
    public DateTimeOffset? NextAttemptAt { get; set; }
    public string? Outcome { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// Remembers which pictures already went out (or were refused for good), so
/// the minute-by-minute rescan does not send them again. Keys are a hash of
/// path + size + write time — the file path can hold a patient's name, and
/// this file should not.
/// The server de-duplicates on content too; this ledger only saves the trip.
/// </summary>
public sealed class UploadLedger
{
    private static readonly TimeSpan KeepFor = TimeSpan.FromDays(365);
    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly string? _path;
    private readonly Lock _gate = new();
    private readonly Dictionary<string, LedgerEntry> _entries;

    private UploadLedger(string? path, Dictionary<string, LedgerEntry> entries)
    {
        _path = path;
        _entries = entries;
    }

    /// <summary>Null path = in memory only (tests).</summary>
    public static UploadLedger Load(string? path, DateTimeOffset now)
    {
        var entries = new Dictionary<string, LedgerEntry>(StringComparer.Ordinal);
        if (path is not null && File.Exists(path))
        {
            try
            {
                var stored = JsonSerializer.Deserialize<Dictionary<string, LedgerEntry>>(File.ReadAllText(path), Json);
                foreach (var (key, entry) in stored ?? [])
                {
                    if (now - entry.UpdatedAt <= KeepFor)
                        entries[key] = entry;
                }
            }
            catch (JsonException)
            {
                // A damaged ledger only costs re-sends, which the server answers as duplicates.
                File.Move(path, path + ".bad", overwrite: true);
            }
        }

        return new UploadLedger(path, entries);
    }

    public static string Fingerprint(string fullPath, long size, DateTime lastWriteUtc)
    {
        var raw = $"{fullPath.ToUpperInvariant()}|{size}|{lastWriteUtc.Ticks}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
    }

    public int Count
    {
        get
        {
            lock (_gate)
                return _entries.Count;
        }
    }

    public LedgerEntry? Find(string key)
    {
        lock (_gate)
            return _entries.TryGetValue(key, out var entry) ? entry : null;
    }

    /// <summary>Sent, or refused for good.</summary>
    public bool IsFinished(string key) => Find(key)?.State is LedgerState.Sent or LedgerState.Rejected;

    /// <summary>When a retrying picture may be tried again; null = now.</summary>
    public DateTimeOffset? NextAttempt(string key) => Find(key)?.NextAttemptAt;

    public void MarkSent(string key, DateTimeOffset now, string outcome) =>
        Put(key, new LedgerEntry { State = LedgerState.Sent, Outcome = outcome, UpdatedAt = now });

    public void MarkRejected(string key, DateTimeOffset now, string outcome) =>
        Put(key, new LedgerEntry { State = LedgerState.Rejected, Outcome = outcome, UpdatedAt = now });

    /// <summary>Counts one more failure and returns how long to wait.</summary>
    public TimeSpan MarkFailed(string key, DateTimeOffset now, string outcome)
    {
        var failures = (Find(key)?.Failures ?? 0) + 1;
        var delay = Backoff.After(failures);
        Put(key, new LedgerEntry
        {
            State = LedgerState.Retrying,
            Failures = failures,
            NextAttemptAt = now + delay,
            Outcome = outcome,
            UpdatedAt = now,
        });
        return delay;
    }

    private void Put(string key, LedgerEntry entry)
    {
        lock (_gate)
        {
            _entries[key] = entry;
            if (_path is null)
                return;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(_path))!);
            var temp = _path + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(_entries, Json));
            File.Move(temp, _path, overwrite: true);
        }
    }
}
