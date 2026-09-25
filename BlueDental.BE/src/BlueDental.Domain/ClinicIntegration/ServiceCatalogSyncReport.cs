using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// The outcome of one "Đồng bộ" press, in the shape the reference's result
/// dialog reads: a summary plus one list per tab.
///
/// Every selected service lands in exactly one bucket, so
/// <c>Total = Sent + Failed + Skipped + Duplicated.Count</c>. <c>Sent</c>
/// counts every service the partner accepted, updates and warnings included —
/// the reference's toast reads "Đã đồng bộ {sent}/{total}" even when all of
/// them were updates.
/// </summary>
public sealed class ServiceCatalogSyncReport
{
    private readonly List<SyncDuplicate> _duplicated = [];
    private readonly List<SyncNote> _warned = [];
    private readonly List<SyncNote> _skipped = [];
    private readonly List<SyncUpdate> _updated = [];
    private readonly List<SyncBatchError> _batchErrors = [];

    public int Total { get; private set; }
    public int Sent { get; private set; }
    public int Failed { get; private set; }

    public int Skipped => _skipped.Count;
    public int Updated => _updated.Count;

    public IReadOnlyList<SyncDuplicate> Duplicated => _duplicated;
    public IReadOnlyList<SyncNote> Warned => _warned;
    public IReadOnlyList<SyncNote> SkippedItems => _skipped;
    public IReadOnlyList<SyncUpdate> UpdatedItems => _updated;
    public IReadOnlyList<SyncBatchError> BatchErrors => _batchErrors;

    /// <summary>A service that cannot be sent at all. The reason shows as a warning toast.</summary>
    public void SkipWithReason(Guid entryId, string? code, string reason)
    {
        Total++;
        _skipped.Add(new SyncNote(code, reason, entryId.ToString()));
    }

    /// <summary>
    /// The partner already has exactly this. No reason, on purpose: the
    /// reference toasts "Không có thay đổi" only when no skip carries one.
    /// </summary>
    public void SkipUnchanged(Guid entryId, string code)
    {
        Total++;
        _skipped.Add(new SyncNote(code, null, entryId.ToString()));
    }

    /// <summary>A whole batch never got an answer; every service in it failed.</summary>
    public void FailBatch(IReadOnlyCollection<PartnerServiceItem> items, string reason, string? message)
    {
        Total += items.Count;
        Failed += items.Count;
        _batchErrors.Add(new SyncBatchError(reason, message));
    }

    /// <summary>
    /// Files the partner's answer for one service.
    /// </summary>
    /// <returns>True when the partner now holds the service, so its sync state should move.</returns>
    public bool Record(PartnerServiceItem item, PartnerServiceResult? result, string noAnswerReason)
    {
        Total++;

        if (result == null)
        {
            Failed++;
            _batchErrors.Add(new SyncBatchError(item.Code, noAnswerReason));
            return false;
        }

        switch (result.Status)
        {
            case PartnerServiceStatus.Created:
                Sent++;
                return true;

            case PartnerServiceStatus.Updated:
                Sent++;
                _updated.Add(new SyncUpdate(item.Code, item.ExternalId, result.Relinked));
                return true;

            case PartnerServiceStatus.Warned:
                Sent++;
                _warned.Add(new SyncNote(item.Code, result.Reason ?? string.Empty, item.ExternalId));
                return true;

            case PartnerServiceStatus.Duplicated:
                _duplicated.Add(new SyncDuplicate(item.Code, item.Name, result.SystemName, item.ExternalId));
                return false;

            default:
                Failed++;
                _batchErrors.Add(new SyncBatchError(item.Code, result.Reason));
                return false;
        }
    }

    /// <summary>Services the partner answered for, keyed by our id; later answers win.</summary>
    public static IReadOnlyDictionary<string, PartnerServiceResult> Index(IEnumerable<PartnerServiceResult> results) =>
        results
            .GroupBy(r => r.ExternalId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);
}

public sealed record SyncDuplicate(string? Code, string DentalName, string? SystemName, string ExternalId);

public sealed record SyncNote(string? Code, string? Reason, string ExternalId);

public sealed record SyncUpdate(string? Code, string ExternalId, bool Relinked);

public sealed record SyncBatchError(string Reason, string? Message);
