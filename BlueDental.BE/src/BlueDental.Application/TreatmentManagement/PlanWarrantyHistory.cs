using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Labo;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Lịch sử bảo hành (REQ-B7), newest first: Labo QC passes and returns, the
/// cards activated — Labo and dental — and the warranty công đoạn opened and
/// finished on the slip (Yêu cầu bảo hành).
/// </summary>
internal sealed class PlanWarrantyHistory(PlanWarrantySnapshot snapshot)
{
    public List<WarrantyEventDto> Events() =>
        snapshot.Lines
            .SelectMany(line => LaboEvents(line).Concat(DentalEvents(line)).Concat(RequestEvents(line)))
            .OrderByDescending(e => e.At)
            .ThenByDescending(e => e.Kind)
            .ToList();

    private IEnumerable<WarrantyEventDto> LaboEvents(TreatmentService line)
    {
        foreach (var order in snapshot.OrdersOf(line))
        {
            foreach (var passed in order.Teeth.Where(t => t.PassedAt.HasValue).GroupBy(t => t.PassedAt!.Value))
            {
                yield return Event(line, passed.Key, WarrantyEventSource.Labo, WarrantyEventKind.LaboPassed, order,
                    passed.Select(t => t.ToothNumber));
            }

            foreach (var round in order.Rounds.Where(r => r.IsReturn))
            {
                var failed = round.ToothResults
                    .Where(r => r.Result == LaboToothCheckResult.Failed)
                    .Select(r => r.ToothNumber)
                    .ToList();
                yield return Event(line, round.ReturnedAt ?? round.CheckedAt ?? round.ReceivedAt,
                    WarrantyEventSource.Labo, WarrantyEventKind.LaboReturned, order,
                    failed.Count > 0 ? failed : order.Teeth.Select(t => t.ToothNumber));
            }

            var activations = order.Teeth
                .Where(t => t.IsWarrantyActivated)
                .GroupBy(t => t.WarrantyActivatedAt!.Value);
            foreach (var activated in activations)
            {
                var e = Event(line, activated.Key, WarrantyEventSource.Labo, WarrantyEventKind.LaboActivated, order,
                    activated.Select(t => t.ToothNumber));
                e.CardCodes = activated.Select(t => t.WarrantyCardCode ?? string.Empty).Order(StringComparer.Ordinal).ToList();
                yield return e;
            }
        }
    }

    private IEnumerable<WarrantyEventDto> DentalEvents(TreatmentService line) =>
        snapshot.CardsOf(line)
            .GroupBy(c => c.ActivatedAt)
            .Select(activated =>
            {
                var e = Event(line, activated.Key, WarrantyEventSource.Dental, WarrantyEventKind.DentalActivated, null,
                    activated.Where(c => c.ToothNumber.HasValue).Select(c => c.ToothNumber!.Value));
                e.CardCodes = activated.Select(c => c.Code).Order(StringComparer.Ordinal).ToList();
                return e;
            });

    private IEnumerable<WarrantyEventDto> RequestEvents(TreatmentService line)
    {
        var requests = snapshot.Stages
            .Where(s => s.TreatmentServiceId == line.Id && s.IsGuarantee && !s.IsSuperseded);
        foreach (var stage in requests)
        {
            var teeth = stage.Teeth.Select(t => t.ToothCode).ToList();
            var order = snapshot.OrdersOf(line).FirstOrDefault(o => o.Id == stage.WarrantyLaboOrderId);
            var codes = CardCodesOf(line, stage, teeth, order);
            var opened = DateTime.SpecifyKind(stage.CreationTime, DateTimeKind.Utc);
            yield return RequestEvent(line, stage, opened, WarrantyEventKind.RequestOpened, teeth, codes, order);
            if (stage.Status == TreatmentStageStatus.Completed)
            {
                yield return RequestEvent(line, stage, stage.CompletedAt ?? opened, WarrantyEventKind.RequestDone,
                    teeth, codes, order);
            }
        }
    }

    /// <summary>
    /// The cards the công đoạn was worked under (REQ-F3..F5): the picked kind's
    /// cards on its teeth — a toothless dental card covers them all. One raised
    /// before the card was picked concerns every card the line holds.
    /// </summary>
    private List<string> CardCodesOf(TreatmentService line, TreatmentStage stage, List<int> teeth, LaboOrder? order)
    {
        var dental = snapshot.CardsOf(line)
            .Where(c => stage.WarrantyKind is null || c.ToothNumber is null || teeth.Contains(c.ToothNumber.Value))
            .Select(c => c.Code);
        var labo = snapshot.OrdersOf(line)
            .Where(o => stage.WarrantyKind is null || o == order)
            .SelectMany(o => o.Teeth)
            .Where(t => t.IsWarrantyActivated && (stage.WarrantyKind is null || teeth.Contains(t.ToothNumber)))
            .Select(t => t.WarrantyCardCode ?? string.Empty);
        return stage.WarrantyKind switch
        {
            WarrantyCardKind.Dental => dental.ToList(),
            WarrantyCardKind.Labo => labo.ToList(),
            _ => dental.Concat(labo).ToList(),
        };
    }

    private WarrantyEventDto RequestEvent(
        TreatmentService line, TreatmentStage stage, DateTimeOffset at, WarrantyEventKind kind,
        IEnumerable<int> teeth, List<string> codes, LaboOrder? order)
    {
        var e = Event(line, at, WarrantyEventSource.Treatment, kind, order, teeth);
        e.CardCodes = codes;
        e.StageName = stage.Name;
        e.StaffName = snapshot.StaffNameOf(stage.StaffId);
        return e;
    }

    private WarrantyEventDto Event(
        TreatmentService line, DateTimeOffset at, WarrantyEventSource source, WarrantyEventKind kind,
        LaboOrder? order, IEnumerable<int> teeth) => new()
    {
        At = at,
        Source = source,
        Kind = kind,
        LineId = line.Id,
        ServiceName = snapshot.ServiceNameOf(line),
        LaboOrderCode = order?.OrderCode,
        Teeth = teeth.Distinct().Order().ToList(),
    };
}
