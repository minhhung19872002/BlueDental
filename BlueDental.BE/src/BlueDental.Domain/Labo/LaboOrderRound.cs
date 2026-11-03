using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Labo;

/// <summary>
/// One "Nhận hàng · lần N": the goods coming in, the per-tooth check and how
/// it ended. A row of the "Lịch sử nhận hàng &amp; trả hàng" table (P2910_03).
/// </summary>
public class LaboOrderRound : Entity<Guid>
{
    public Guid LaboOrderId { get; private set; }

    /// <summary>1-based, in the order the goods came in.</summary>
    public int RoundNo { get; private set; }

    /// <summary>Ngày nhận thực tế.</summary>
    public DateTimeOffset ReceivedAt { get; private set; }

    /// <summary>Số lượng nhận — never more than the order's Số lượng.</summary>
    public int ReceivedQuantity { get; private set; }

    /// <summary>Người nhận · kiểm tra: the user who saved the receive part.</summary>
    public Guid? ReceiverId { get; private set; }

    public DateTimeOffset? CheckedAt { get; private set; }
    public LaboRoundOutcome Outcome { get; private set; }

    /// <summary>Mô tả gửi Labo — what goes back with the returned teeth.</summary>
    public string? ReturnDescription { get; private set; }

    /// <summary>Ngày trả hàng.</summary>
    public DateTimeOffset? ReturnedAt { get; private set; }

    /// <summary>Hẹn Labo giao lại — becomes the order's due stamp.</summary>
    public DateTimeOffset? RedeliveryDueAt { get; private set; }

    private readonly List<LaboRoundToothResult> _toothResults = [];

    /// <summary>The teeth checked in this round, as they were found then.</summary>
    public IReadOnlyCollection<LaboRoundToothResult> ToothResults => _toothResults.AsReadOnly();

    protected LaboOrderRound() { }

    internal static LaboOrderRound Open(
        Guid id, Guid laboOrderId, int roundNo,
        DateTimeOffset receivedAt, int receivedQuantity, Guid? receiverId) =>
        new()
        {
            Id = id,
            LaboOrderId = laboOrderId,
            RoundNo = roundNo,
            ReceivedAt = receivedAt,
            ReceivedQuantity = receivedQuantity,
            ReceiverId = receiverId,
            Outcome = LaboRoundOutcome.Pending
        };

    public bool IsReturn => Outcome is LaboRoundOutcome.ReturnedAll or LaboRoundOutcome.ReturnedDefective;

    /// <summary>The receive part saved again before the check was.</summary>
    internal void Amend(DateTimeOffset receivedAt, int receivedQuantity, Guid? receiverId)
    {
        ReceivedAt = receivedAt;
        ReceivedQuantity = receivedQuantity;
        ReceiverId = receiverId;
    }

    internal void Pass(IEnumerable<LaboRoundToothResult> results, DateTimeOffset checkedAt)
    {
        Close(results, checkedAt, LaboRoundOutcome.Passed);
    }

    internal void Return(
        IEnumerable<LaboRoundToothResult> results, DateTimeOffset checkedAt, bool returnAll,
        string description, DateTimeOffset returnedAt, DateTimeOffset redeliveryDueAt)
    {
        Close(results, checkedAt,
            returnAll ? LaboRoundOutcome.ReturnedAll : LaboRoundOutcome.ReturnedDefective);
        ReturnDescription = description;
        ReturnedAt = returnedAt;
        RedeliveryDueAt = redeliveryDueAt;
    }

    private void Close(IEnumerable<LaboRoundToothResult> results, DateTimeOffset checkedAt, LaboRoundOutcome outcome)
    {
        _toothResults.Clear();
        _toothResults.AddRange(results.OrderBy(r => r.ToothNumber));
        CheckedAt = checkedAt;
        Outcome = outcome;
    }
}
