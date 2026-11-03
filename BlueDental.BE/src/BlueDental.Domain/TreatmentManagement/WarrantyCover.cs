using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Labo;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The warranty card a warranty công đoạn is worked under (P3110 REQ-F3..F5):
/// "Nha khoa" — the line's dental cards still valid today; "Labo" — one Labo
/// order of the line whose teeth carry an activated, unexpired warranty.
///
/// Replaces the catalog's "warranty days counted from Ngày điều trị" (G23): a
/// line is under warranty while one of its cards is.
/// </summary>
public sealed class WarrantyCover
{
    public WarrantyCardKind Kind { get; }

    /// <summary>Labo only: the order picked in "Chọn phiếu Labo".</summary>
    public Guid? LaboOrderId { get; }

    /// <summary>The teeth the card covers; null = the whole line (a card without a tooth).</summary>
    public IReadOnlySet<int>? Teeth { get; }

    private WarrantyCover(WarrantyCardKind kind, Guid? laboOrderId, IReadOnlySet<int>? teeth)
    {
        Kind = kind;
        LaboOrderId = laboOrderId;
        Teeth = teeth;
    }

    public static WarrantyCover Resolve(
        WarrantyCardKind? kind,
        Guid? laboOrderId,
        Guid lineId,
        IEnumerable<ServiceWarrantyCard> lineCards,
        IEnumerable<LaboOrder> lineOrders,
        DateOnly today)
    {
        return kind switch
        {
            WarrantyCardKind.Dental => Dental(laboOrderId, lineId, lineCards, today),
            WarrantyCardKind.Labo => Labo(laboOrderId, lineId, lineOrders, today),
            _ => throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyKindRequired,
                "Pick the warranty card: Nha khoa or Labo."),
        };
    }

    /// <summary>Every picked tooth must be one the card covers.</summary>
    public void EnsureCovers(IReadOnlyCollection<ToothSelection> requested)
    {
        if (Teeth is not null && requested.Any(t => !Teeth.Contains(t.ToothCode)))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyToothNotCovered,
                "That tooth has no valid warranty card.");
        }
    }

    private static WarrantyCover Dental(
        Guid? laboOrderId, Guid lineId, IEnumerable<ServiceWarrantyCard> lineCards, DateOnly today)
    {
        if (laboOrderId.HasValue)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLaboOrderInvalid,
                "A dental warranty names no Labo order.");
        }

        var valid = lineCards
            .Where(c => c.TreatmentServiceId == lineId && !c.IsExpiredOn(today))
            .ToList();
        if (valid.Count == 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyCardNotValid,
                "This line has no valid dental warranty card.");
        }

        IReadOnlySet<int>? teeth = valid.Any(c => c.ToothNumber is null)
            ? null
            : valid.Select(c => c.ToothNumber!.Value).ToHashSet();
        return new WarrantyCover(WarrantyCardKind.Dental, null, teeth);
    }

    private static WarrantyCover Labo(
        Guid? laboOrderId, Guid lineId, IEnumerable<LaboOrder> lineOrders, DateOnly today)
    {
        var order = lineOrders.FirstOrDefault(o =>
            o.Id == laboOrderId && o.TreatmentServiceId == lineId && o.Status != LaboStatus.Cancelled);
        var teeth = order?.Teeth
            .Where(t => t.IsWarrantyActivated && !t.IsWarrantyExpiredOn(today))
            .Select(t => t.ToothNumber)
            .ToHashSet();
        if (order is null || teeth is not { Count: > 0 })
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyLaboOrderInvalid,
                "Pick a Labo order of this line with a valid warranty.");
        }

        return new WarrantyCover(WarrantyCardKind.Labo, order.Id, teeth);
    }
}
