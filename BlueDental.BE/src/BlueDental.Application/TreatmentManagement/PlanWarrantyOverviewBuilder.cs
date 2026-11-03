using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Labo;
using BlueDental.PatientManagement;

namespace BlueDental.TreatmentManagement;

/// <summary>An Ảnh thẻ: of a dental card, or of a Labo order's tooth.</summary>
internal sealed record PlanWarrantyPhoto(
    Guid Id, Guid? ServiceWarrantyCardId, Guid? LaboOrderId, int? LaboToothNumber, WarrantyCardSide Side);

/// <summary>Everything the Bảo hành tab reads, loaded once.</summary>
internal sealed record PlanWarrantySnapshot(
    DateOnly Today,
    TreatmentPlan Plan,
    IReadOnlyList<TreatmentService> Lines,
    IReadOnlyList<TreatmentStage> Stages,
    IReadOnlyList<ServiceWarrantyCard> Cards,
    IReadOnlyList<LaboOrder> Orders,
    IReadOnlyDictionary<Guid, string> ServiceNames,
    IReadOnlyDictionary<Guid, int> WarrantyDays,
    IReadOnlyDictionary<Guid, string> SupplierNames,
    IReadOnlyDictionary<Guid, string> MaterialNames,
    IReadOnlyDictionary<Guid, string> StaffNames,
    IReadOnlyList<PlanWarrantyPhoto> Photos)
{
    public string ServiceNameOf(TreatmentService line) => ServiceNames.GetValueOrDefault(line.ServiceId) ?? string.Empty;

    public string? StaffNameOf(Guid? id) => id is { } staffId ? StaffNames.GetValueOrDefault(staffId) : null;

    public IEnumerable<ServiceWarrantyCard> CardsOf(TreatmentService line) =>
        Cards.Where(c => c.TreatmentServiceId == line.Id);

    public IEnumerable<LaboOrder> OrdersOf(TreatmentService line) =>
        Orders.Where(o => o.TreatmentServiceId == line.Id).OrderBy(o => o.CreationTime);

    public string? DentistNameOf(TreatmentService line) => StaffNameOf(line.DentistId ?? Plan.DentistId);
}

/// <summary>
/// Reads a <see cref="PlanWarrantySnapshot"/> into the tab: the status table
/// (REQ-B3), Phiếu bảo hành đã kích hoạt (REQ-B6) and Lịch sử (REQ-B7).
/// </summary>
internal sealed class PlanWarrantyOverviewBuilder(PlanWarrantySnapshot snapshot)
{
    private const string PhotoUrl = "/api/v1/app/patient-images/{0}/content";

    public PlanWarrantyOverviewDto Build()
    {
        var rows = snapshot.Lines.Select(RowOf).ToList();
        var requests = snapshot.Stages.Where(s => s.IsGuarantee && !s.IsSuperseded).ToList();
        return new PlanWarrantyOverviewDto
        {
            Today = snapshot.Today,
            TabCount = snapshot.Lines.Count(l => l.IsCompleted)
                       + snapshot.Orders.Count(o => o.IsQualityPassed && o.ReturnCount == 0),
            PendingCount = rows.Count(r => r.Group == WarrantyRowGroup.Ready),
            Rows = rows,
            Cards = DentalCards().Concat(LaboCards())
                .OrderByDescending(c => c.ActivatedAt)
                .ThenBy(c => c.Code, StringComparer.Ordinal)
                .ToList(),
            History = new PlanWarrantyHistory(snapshot).Events(),
            OpenRequests = requests.Count(s => s.Status != TreatmentStageStatus.Completed),
            DoneRequests = requests.Count(s => s.Status == TreatmentStageStatus.Completed),
        };
    }

    /// <summary>
    /// G16 — the clinic day a finished line was finished: its last worked
    /// công đoạn, or, on a line marked done by hand, the day it was last changed.
    /// </summary>
    public static DateOnly? CompletedOn(TreatmentService line, IEnumerable<TreatmentStage> stages)
    {
        if (!line.IsCompleted)
        {
            return null;
        }

        return stages
                   .Where(s => s.TreatmentServiceId == line.Id && IsWorked(s))
                   .Where(s => s.Status == TreatmentStageStatus.Completed)
                   .Select(s => (DateOnly?)s.TreatmentDate)
                   .Max()
               ?? DayOf(line.LastModificationTime ?? line.CreationTime);
    }

    internal static DateOnly DayOf(DateTime utc) =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)));

    /// <summary>A công đoạn of the treatment itself — not a warranty one, not replaced.</summary>
    private static bool IsWorked(TreatmentStage stage) => !stage.IsGuarantee && !stage.IsSuperseded;

    private WarrantyServiceRowDto RowOf(TreatmentService line)
    {
        var cards = snapshot.CardsOf(line).ToList();
        var orders = snapshot.OrdersOf(line).ToList();
        var days = snapshot.WarrantyDays.GetValueOrDefault(line.ServiceId);
        var teeth = line.Teeth.Select(t => t.ToothCode).Distinct().Order().ToList();
        var carded = cards.Select(c => c.ToothNumber).ToHashSet();
        var pending = (teeth.Count == 0 ? [null] : teeth.Select(t => (int?)t))
            .Where(t => !carded.Contains(t))
            .ToList();
        // No clinic warranty while the lab still owes its work (BA 2026-11-02).
        var dentalReady = line.IsCompleted && !orders.Any(o => o.IsUnfinished);
        var awaiting = orders.FirstOrDefault(o => o.HasTeethAwaitingWarranty);
        var laboCards = orders.Sum(o => o.Teeth.Count(t => t.IsWarrantyActivated));
        var current = line.IsCompleted
            ? null
            : snapshot.Stages
                .Where(s => s.TreatmentServiceId == line.Id && IsWorked(s))
                .MaxBy(s => s.SequenceNumber);

        var row = new WarrantyServiceRowDto
        {
            LineId = line.Id,
            LineCode = line.Code,
            ServiceName = snapshot.ServiceNameOf(line),
            Teeth = teeth,
            DentistName = snapshot.DentistNameOf(line),
            LaboOrderCodes = orders.Select(o => o.OrderCode).ToList(),
            Status = line.Status,
            CompletedOn = CompletedOn(line, snapshot.Stages),
            CurrentStageNumber = current?.SequenceNumber,
            CurrentStageName = current?.Name,
            LaboFitted = orders.Any(o => o.IsQualityPassed),
            WarrantyDays = days,
            Dental = DentalCell(dentalReady, days, pending.Count, cards.Count),
            DentalCardCount = cards.Count,
            DentalPendingTeeth = dentalReady ? pending : [],
            Labo = LaboCell(orders.Count, awaiting, laboCards),
            LaboCardCount = laboCards,
            PendingLaboOrderId = awaiting?.Id,
        };
        row.Group = GroupOf(row);
        return row;
    }

    private static WarrantyCellState DentalCell(bool ready, int days, int pending, int cards)
    {
        if (ready && days > 0 && pending > 0) return WarrantyCellState.Pending;
        if (cards > 0) return WarrantyCellState.Activated;
        return days > 0 ? WarrantyCellState.NotEligible : WarrantyCellState.None;
    }

    private static WarrantyCellState LaboCell(int orders, LaboOrder? awaiting, int cards)
    {
        if (orders == 0) return WarrantyCellState.None;
        if (awaiting is not null) return WarrantyCellState.Pending;
        return cards > 0 ? WarrantyCellState.Activated : WarrantyCellState.NotEligible;
    }

    private static WarrantyRowGroup GroupOf(WarrantyServiceRowDto row)
    {
        WarrantyCellState[] cells = [row.Dental, row.Labo];
        if (cells.Contains(WarrantyCellState.Pending)) return WarrantyRowGroup.Ready;
        return cells.Contains(WarrantyCellState.Activated) ? WarrantyRowGroup.Activated : WarrantyRowGroup.NotEligible;
    }

    private IEnumerable<WarrantyCardRowDto> DentalCards() =>
        snapshot.Lines.SelectMany(line => snapshot.CardsOf(line).Select(card => new WarrantyCardRowDto
        {
            Code = card.Code,
            Kind = WarrantyCardKind.Dental,
            LineId = line.Id,
            ServiceName = snapshot.ServiceNameOf(line),
            ToothNumber = card.ToothNumber,
            DentistName = snapshot.DentistNameOf(line),
            StartDate = card.StartDate,
            EndDate = card.EndDate,
            DurationMonths = card.DurationMonths,
            DurationDays = card.DurationDays,
            Conditions = card.Conditions,
            ActivatedAt = card.ActivatedAt,
            Photos = PhotosOf(p => p.ServiceWarrantyCardId == card.Id),
        }));

    private IEnumerable<WarrantyCardRowDto> LaboCards() =>
        from line in snapshot.Lines
        from order in snapshot.OrdersOf(line)
        from tooth in order.Teeth.OrderBy(t => t.ToothNumber)
        where tooth.IsWarrantyActivated
        select new WarrantyCardRowDto
        {
            Code = tooth.WarrantyCardCode ?? string.Empty,
            Kind = WarrantyCardKind.Labo,
            LineId = line.Id,
            ServiceName = snapshot.ServiceNameOf(line),
            ToothNumber = tooth.ToothNumber,
            LaboOrderId = order.Id,
            LaboOrderCode = order.OrderCode,
            SupplierName = order.SupplierId is { } supplierId
                ? snapshot.SupplierNames.GetValueOrDefault(supplierId) ?? order.LabProviderName
                : order.LabProviderName,
            MaterialName = order.MaterialId is { } materialId ? snapshot.MaterialNames.GetValueOrDefault(materialId) : null,
            ManufacturerSerial = tooth.ManufacturerSerial,
            StartDate = tooth.WarrantyStartDate ?? default,
            EndDate = tooth.WarrantyEndDate ?? default,
            DurationMonths = tooth.WarrantyMonths,
            Conditions = tooth.WarrantyConditions,
            ActivatedAt = tooth.WarrantyActivatedAt!.Value,
            Photos = PhotosOf(p => p.LaboOrderId == order.Id && p.LaboToothNumber == tooth.ToothNumber),
        };

    private List<WarrantyCardPhotoDto> PhotosOf(Func<PlanWarrantyPhoto, bool> belongs) =>
        snapshot.Photos
            .Where(belongs)
            .Select(p => new WarrantyCardPhotoDto { Id = p.Id, Url = string.Format(PhotoUrl, p.Id), Side = p.Side })
            .ToList();
}
