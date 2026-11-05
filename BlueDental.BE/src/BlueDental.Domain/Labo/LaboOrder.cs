using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

/// <summary>
/// A Labo order and its P2910_03 workflow (BA state machine, 2026-10-30):
/// <code>
/// Nháp ──Tạo phiếu Labo──▶ Đã gửi Labo ──nhận hàng──▶ Chờ kiểm tra ──mọi răng Đạt──▶ Hoàn thành ──kích hoạt──▶ Bảo hành
///                              ▲                         │
///                              └──── Trả hàng ◀──────────┘ (Trả toàn bộ / Trả hàng bị lỗi)
/// </code>
/// Nháp, Đã gửi Labo and Chờ kiểm tra may be cancelled; a cancelled order stays
/// listed. "Hết hạn bảo hành" is never stored — see <see cref="IsWarrantyExpiredOn"/>.
/// </summary>
public class LaboOrder : FullAuditedAggregateRoot<Guid>
{
    /// <summary>
    /// Ảnh đính kèm chung, and the pictures of one tooth's row: at most this
    /// many, none required (P3110).
    /// </summary>
    public const int MaxOrderImages = 5;

    /// <summary>Thời hạn bảo hành "Khác" is capped so the end date stays a real date.</summary>
    public const int MaxWarrantyMonths = 600;

    public string OrderCode { get; private set; } = default!;
    public Guid PatientId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? DentistId { get; private set; }

    /// <summary>The supplier's name as it was when the order was written; blank on a draft without one.</summary>
    public string LabProviderName { get; private set; } = string.Empty;
    public LaboStatus Status { get; private set; }

    /// <summary>
    /// The teeth as text, ", "-joined — kept in step with <see cref="Teeth"/> for
    /// the readers that predate the tooth rows (Mẫu Labo list, print, export).
    /// </summary>
    public string? ToothNumbers { get; private set; }
    public string? WorkDescription { get; private set; }
    public string? Notes { get; private set; }

    /// <summary>
    /// The current due stamp: Ngày nhận dự kiến + Giờ nhận, then each
    /// Hẹn Labo giao lại once goods are sent back.
    /// </summary>
    public DateTimeOffset? DueAt { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }

    /// <summary>Ngày nhận thực tế of the latest round.</summary>
    public DateTimeOffset? ReceivedAt { get; private set; }
    public decimal EstimatedCost { get; private set; }

    /// <summary>Written by the pre-P2910_03 Từ chối action; read back only.</summary>
    public string? RejectionReason { get; private set; }

    /// <summary>Đơn hàng mới, or the kind of an order raised before P2910_03.</summary>
    public LaboOrderKind Kind { get; private set; }

    public Guid? SupplierId { get; private set; }
    public Guid? MaterialId { get; private set; }
    public Guid? BiteId { get; private set; }
    public Guid? FinishLineId { get; private set; }
    public Guid? RhythmId { get; private set; }

    /// <summary>Where the file the clinic sent back was stored, on old orders.</summary>
    public string? AttachmentUrl { get; private set; }

    /// <summary>
    /// Màu răng of the first tooth. Since P3110 each tooth carries its own
    /// spec; this and the Bite/FinishLine/Rhythm columns mirror the first row
    /// for the readers that predate it (Mẫu Labo list, print, export).
    /// </summary>
    public string? ToothShade { get; private set; }

    /// <summary>Thông số răng / Màu răng Chung or Riêng (R-1150; was the SharedSpec tick).</summary>
    public LaboSpecMode SpecMode { get; private set; } = LaboSpecMode.PerTooth;

    /// <summary>Số lượng. Always at least one unit of work.</summary>
    public int Quantity { get; private set; } = 1;

    /// <summary>The service line the order is for, and the công đoạn it was raised on (if any).</summary>
    public Guid? TreatmentServiceId { get; private set; }
    public Guid? TreatmentStageId { get; private set; }

    /// <summary>
    /// The order a pre-P2910_03 Làm tiếp công đoạn / Bảo hành order was raised
    /// from. No new order has one; the old ones still read back with it.
    /// </summary>
    public Guid? ParentOrderId { get; private set; }

    private readonly List<LaboOrderTooth> _teeth = [];
    public IReadOnlyCollection<LaboOrderTooth> Teeth => _teeth.AsReadOnly();

    private readonly List<LaboOrderRound> _rounds = [];
    public IReadOnlyCollection<LaboOrderRound> Rounds => _rounds.AsReadOnly();

    protected LaboOrder() { }

    /// <summary>Lưu nháp: a new order starts as a draft, however little is filled in.</summary>
    public LaboOrder(Guid id, string orderCode, Guid patientId, Guid branchId, LaboOrderDetails details)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(orderCode, nameof(orderCode));
        OrderCode = orderCode;
        PatientId = patientId;
        BranchId = branchId;
        Kind = LaboOrderKind.New;
        Status = LaboStatus.Draft;
        Apply(details);
    }

    public LaboOrderRound? LatestRound => _rounds.MaxBy(r => r.RoundNo);

    /// <summary>Số lần trả hàng.</summary>
    public int ReturnCount => _rounds.Count(r => r.IsReturn);

    /// <summary>
    /// "Đã trả: n lần" of one tooth (P3110 REQ-D5): the returns in which that
    /// tooth was Lỗi. A tooth that was Đạt rides along on Trả toàn bộ uncounted.
    /// </summary>
    public int ToothReturnCount(int toothNumber) =>
        _rounds.Count(r => r.IsReturn && r.ToothResults.Any(
            t => t.ToothNumber == toothNumber && t.Result == LaboToothCheckResult.Failed));

    /// <summary>Đạt QC: Hoàn thành or Bảo hành, expired or not.</summary>
    public bool IsQualityPassed => Status is LaboStatus.Completed or LaboStatus.Warranty;

    /// <summary>
    /// The lab still owes the clinic this order: its service line can be
    /// neither cancelled nor converted, and the later công đoạn stay locked.
    /// </summary>
    public bool IsUnfinished => Status != LaboStatus.Cancelled && !IsQualityPassed;

    /// <summary>
    /// The clinic day the order's last tooth passed QC (P3110): công đoạn
    /// worked before it stay locked. Null until QC passed — and on an order
    /// passed without its teeth loaded.
    /// </summary>
    public DateOnly? QualityPassedOn =>
        IsQualityPassed && _teeth.Any(t => t.PassedAt.HasValue)
            ? ClinicCalendar.DateOf(_teeth.Where(t => t.PassedAt.HasValue).Max(t => t.PassedAt!.Value))
            : null;

    /// <summary>Kích hoạt bảo hành is still on offer: QC passed, and a passed tooth has no card yet.</summary>
    public bool HasTeethAwaitingWarranty =>
        IsQualityPassed
        && _teeth.Any(t => t.CheckResult == LaboToothCheckResult.Passed && !t.IsWarrantyActivated);

    /// <summary>Hết hạn bảo hành: in warranty, and every activated tooth's card has run out.</summary>
    public bool IsWarrantyExpiredOn(DateOnly today) =>
        Status == LaboStatus.Warranty
        && _teeth.Where(t => t.IsWarrantyActivated).All(t => t.IsWarrantyExpiredOn(today));

    /// <summary>
    /// <see cref="IsWarrantyExpiredOn"/> as a query, so the Hết hạn / Đang bảo
    /// hành counters and filters read the rule the same way the rows do.
    /// </summary>
    public static Expression<Func<LaboOrder, bool>> WarrantyExpiredOn(DateOnly today) =>
        o => o.Status == LaboStatus.Warranty
             && o.Teeth.All(t => t.WarrantyActivatedAt == null || t.WarrantyEndDate < today);

    /// <summary>Lưu nháp again: only a draft is still editable.</summary>
    public LaboOrder UpdateDraft(LaboOrderDetails details)
    {
        EnsureStatus(LaboStatus.Draft);
        Apply(details);
        return this;
    }

    /// <summary>
    /// Gửi Labo: every required field of Đặt hàng is filled, and every tooth
    /// has its Màu răng and Đường hoàn tất. Pictures are optional (P3110).
    /// The tab locks.
    /// </summary>
    public LaboOrder Submit()
    {
        EnsureStatus(LaboStatus.Draft);
        if (!TreatmentServiceId.HasValue || !DentistId.HasValue || !SupplierId.HasValue
            || !MaterialId.HasValue || !SentAt.HasValue || !DueAt.HasValue
            || _teeth.Count == 0 || string.IsNullOrWhiteSpace(LabProviderName))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.OrderIncomplete);
        }

        var noSurface = _teeth.FirstOrDefault(t => t.Surfaces.Count == 0);
        if (noSurface is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothSurfaceMissing)
                .WithData("tooth", noSurface.ToothNumber);

        var noShade = _teeth.FirstOrDefault(t => !t.HasShade);
        if (noShade is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothSpecIncomplete)
                .WithData("tooth", noShade.ToothNumber);

        Status = LaboStatus.Sent;
        return this;
    }

    /// <summary>A set of the order's pictures — the shared ones, or one tooth's: never more than five.</summary>
    public static void EnsureImageCount(int imageCount)
    {
        if (imageCount > MaxOrderImages)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ImageCountInvalid);
    }

    /// <summary>Hủy phiếu: the order stays listed as Đã hủy.</summary>
    public LaboOrder Cancel()
    {
        if (Status is not (LaboStatus.Draft or LaboStatus.Sent or LaboStatus.AwaitingCheck))
            throw InvalidTransition("cancel");
        Status = LaboStatus.Cancelled;
        return this;
    }

    /// <summary>The bin on the list removes a draft only.</summary>
    public void EnsureDeletable()
    {
        if (Status != LaboStatus.Draft)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.DeleteOnlyDraft);
    }

    /// <summary>
    /// The service line was cancelled or converted ("Hủy phiếu Labo" on the
    /// Chuyển đổi dialog): whatever the lab still owes is called off.
    /// </summary>
    public LaboOrder CancelForServiceChange()
    {
        if (IsUnfinished)
            Status = LaboStatus.Cancelled;
        return this;
    }

    /// <summary>
    /// A. Nhận hàng · lần N. From Đã gửi Labo or Trả hàng it opens the next
    /// round and moves to Chờ kiểm tra; every tooth not already Đạt waits for
    /// its check. Saved again before the check, it corrects the open round.
    /// </summary>
    public LaboOrder Receive(Guid roundId, DateTimeOffset receivedAt, int receivedQuantity, Guid? receiverId)
    {
        var open = Status == LaboStatus.AwaitingCheck ? OpenRound() : null;
        if (open is null && Status is not (LaboStatus.Sent or LaboStatus.Returned))
            throw InvalidTransition("receive");
        if (receivedQuantity < 1 || receivedQuantity > Quantity)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ReceivedQuantityInvalid);
        if (SentAt.HasValue && ClinicCalendar.DateOf(receivedAt) < ClinicCalendar.DateOf(SentAt.Value))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ReceivedBeforeSent);

        ReceivedAt = receivedAt;
        if (open is not null)
        {
            open.Amend(receivedAt, receivedQuantity, receiverId);
            return this;
        }

        foreach (var tooth in _teeth.Where(t => t.CheckResult != LaboToothCheckResult.Passed))
            tooth.Reopen();
        _rounds.Add(LaboOrderRound.Open(
            roundId, Id, _rounds.Count + 1, receivedAt, receivedQuantity, receiverId));
        Status = LaboStatus.AwaitingCheck;
        return this;
    }

    /// <summary>Xác nhận Labo đạt: every tooth of the round is Đạt, the order is Hoàn thành.</summary>
    public LaboOrder ConfirmPassed(IReadOnlyCollection<LaboRoundToothResult> results, DateTimeOffset checkedAt)
    {
        var (round, checks) = ValidateCheck(results);
        if (checks.Any(c => c.Result != LaboToothCheckResult.Passed))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.NotAllPassed);

        foreach (var check in checks)
            ToothOf(check.ToothNumber).Pass(checkedAt);
        round.Pass(checks, checkedAt);
        Status = LaboStatus.Completed;
        return this;
    }

    /// <summary>
    /// Trả toàn bộ / Trả hàng bị lỗi. With "bị lỗi" the Đạt teeth stay Đạt
    /// (and show on the Bảo hành tab); with "toàn bộ" every tooth goes back and
    /// is checked again. Hẹn Labo giao lại becomes the due stamp. Each Lỗi
    /// tooth carries its own Mô tả gửi Labo and at least one Hình ảnh lỗi
    /// (P3110 REQ-D6); the round's description is the caller's, or those joined.
    /// </summary>
    public LaboOrder ReturnToLab(
        IReadOnlyCollection<LaboRoundToothResult> results, LaboReturnRequest request, DateTimeOffset checkedAt)
    {
        var (round, checks) = ValidateCheck(results);
        if (checks.All(c => c.Result != LaboToothCheckResult.Failed))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ReturnNeedsDefect);
        var undescribed = checks.FirstOrDefault(c => c.Result == LaboToothCheckResult.Failed && c.Note is null);
        if (undescribed is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.DefectDescriptionRequired)
                .WithData("tooth", undescribed.ToothNumber);
        if (request.ReturnedAt is not { } returnedAt || request.RedeliveryDueAt is not { } redeliveryDueAt)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ReturnDetailsRequired);
        if (redeliveryDueAt <= returnedAt)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.RedeliveryBeforeReturn);
        var unpictured = checks.FirstOrDefault(c =>
            c.Result == LaboToothCheckResult.Failed && !request.PicturedTeeth.Contains(c.ToothNumber));
        if (unpictured is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.CheckImagesRequired)
                .WithData("tooth", unpictured.ToothNumber);

        foreach (var check in checks)
        {
            var tooth = ToothOf(check.ToothNumber);
            if (check.Result == LaboToothCheckResult.Failed)
                tooth.Fail(check.Note);
            else
                tooth.Pass(checkedAt);
        }

        if (request.ReturnAll)
        {
            foreach (var tooth in _teeth.Where(t => t.CheckResult == LaboToothCheckResult.Passed))
                tooth.Reopen();
        }

        var description = Blank(request.Description) ?? string.Join("; ", checks
            .Where(c => c.Result == LaboToothCheckResult.Failed)
            .Select(c => $"R{c.ToothNumber}: {c.Note}"));
        round.Return(checks, checkedAt, request.ReturnAll, description, returnedAt, redeliveryDueAt);
        DueAt = redeliveryDueAt;
        Status = LaboStatus.Returned;
        return this;
    }

    /// <summary>
    /// Kích hoạt bảo hành (n răng): each Đạt tooth not activated yet gets its
    /// card. Only once the whole order is Hoàn thành; the first card moves it
    /// to Bảo hành.
    /// </summary>
    /// <param name="codes">Each card's number from <c>WarrantyCardCode.IssueAsync</c> on the order's service line, in card order.</param>
    public LaboOrder ActivateWarranty(
        IReadOnlyList<LaboWarrantyActivation> cards, IReadOnlyList<string> codes, DateTimeOffset activatedAt, Guid? activatedById)
    {
        if (Status is not (LaboStatus.Completed or LaboStatus.Warranty))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.WarrantyNotAvailable);
        if (cards.Count == 0 || cards.Select(c => c.ToothNumber).Distinct().Count() != cards.Count)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotWarrantable);
        if (codes.Count != cards.Count)
            throw new ArgumentException("One code per card.", nameof(codes));

        var teeth = cards.Select(card => (card, tooth: ToothOf(card.ToothNumber))).ToList();
        foreach (var (card, tooth) in teeth)
        {
            if (tooth.CheckResult != LaboToothCheckResult.Passed || tooth.IsWarrantyActivated)
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotWarrantable);
            if (card.Months is < 1 or > MaxWarrantyMonths)
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.WarrantyMonthsInvalid);
            if (tooth.PassedAt is { } passedAt && card.StartDate < ClinicCalendar.DateOf(passedAt))
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.WarrantyStartBeforePass);
        }

        foreach (var ((card, tooth), code) in teeth.Zip(codes))
        {
            var trimmed = card with
            {
                ManufacturerSerial = Blank(card.ManufacturerSerial),
                Conditions = Blank(card.Conditions)
            };
            tooth.ActivateWarranty(code, trimmed, activatedAt, activatedById);
        }

        Status = LaboStatus.Warranty;
        return this;
    }

    private void Apply(LaboOrderDetails details)
    {
        Check.NotNull(details, nameof(details));
        DentistId = details.DentistId;
        LabProviderName = details.LabProviderName?.Trim() ?? string.Empty;
        SupplierId = details.SupplierId;
        MaterialId = details.MaterialId;
        Quantity = details.Quantity < 1 ? 1 : details.Quantity;
        WorkDescription = Blank(details.WorkDescription);
        Notes = Blank(details.Notes);
        EstimatedCost = details.EstimatedCost;
        TreatmentServiceId = details.TreatmentServiceId;
        TreatmentStageId = details.TreatmentStageId;
        SentAt = DayOf(details.SentAt);
        SetDueAt(DayOf(details.DueAt));
        SetTeeth(details.Teeth);
        SetToothSpecs(details);
    }

    /// <summary>
    /// Thông số từng răng. A caller that sends no rows (pre-P3110) gives every
    /// tooth the order-level values (G8) and leaves its surfaces as they were.
    /// Otherwise the mode decides what is shared (R-1150): Chung thông số
    /// copies the first row's Đường hoàn tất and Kiểu nhịp to every tooth,
    /// chung màu its Màu răng too. Khớp cắn is the order's and goes to every
    /// tooth. The order-level Màu / Đường hoàn tất / Kiểu nhịp then mirror the
    /// first tooth.
    /// </summary>
    private void SetToothSpecs(LaboOrderDetails details)
    {
        SpecMode = Enum.IsDefined(details.SpecMode) ? details.SpecMode : LaboSpecMode.PerTooth;
        BiteId = details.BiteId;
        var specs = details.ToothSpecs?.GroupBy(s => s.ToothNumber).ToDictionary(g => g.Key, g => g.Last());
        if (specs is null)
        {
            foreach (var tooth in _teeth)
                tooth.SetSpec(details.ToothShade, details.FinishLineId, details.RhythmId, BiteId);
        }
        else
        {
            SetModeSpecs(details.Teeth, specs);
        }

        var first = details.Teeth.Count == 0 ? null : ToothOf(details.Teeth[0]);
        if (first is null)
        {
            // A draft without teeth keeps whatever order-level values it was given.
            ToothShade = specs is null ? Blank(details.ToothShade) : null;
            FinishLineId = specs is null ? details.FinishLineId : null;
            RhythmId = specs is null ? details.RhythmId : null;
            return;
        }

        ToothShade = first.Shade;
        FinishLineId = first.FinishLineId;
        RhythmId = first.RhythmId;
    }

    private void SetModeSpecs(IReadOnlyList<int> picked, Dictionary<int, LaboToothSpec> specs)
    {
        var lead = picked.Select(n => specs.GetValueOrDefault(n)).FirstOrDefault(s => s is not null);
        var sharedSpec = SpecMode != LaboSpecMode.PerTooth;
        var sharedShade = SpecMode == LaboSpecMode.SharedAll;
        foreach (var tooth in _teeth)
        {
            var own = specs.GetValueOrDefault(tooth.ToothNumber);
            var spec = sharedSpec ? lead : own;
            tooth.SetSpec(sharedShade ? lead?.Shade : own?.Shade, spec?.FinishLineId, spec?.RhythmId, BiteId);
            tooth.SetSurfaces(own?.Surfaces ?? [], !sharedShade && (own?.ShadeBySurface ?? false), !sharedSpec);
        }
    }

    /// <summary>Ngày gửi / Ngày nhận dự kiến are days (P3110): kept as the clinic's midnight.</summary>
    private static DateTimeOffset? DayOf(DateTimeOffset? stamp) =>
        stamp is { } value ? ClinicCalendar.StartOfDay(ClinicCalendar.DateOf(value)) : null;

    /// <summary>"Ngày nhận dự kiến phải sau ngày gửi": a due day on or before the sent day is refused.</summary>
    private void SetDueAt(DateTimeOffset? dueAt)
    {
        if (dueAt.HasValue && SentAt.HasValue && dueAt.Value <= SentAt.Value)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.DueBeforeSent);
        DueAt = dueAt;
    }

    private void SetTeeth(IReadOnlyList<int> picked)
    {
        var teeth = picked.Distinct().ToList();
        var invalid = teeth.FirstOrDefault(t => !ToothSelection.IsValidToothCode(t));
        if (invalid != 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.InvalidToothCode,
                $"Tooth code {invalid} is not a valid FDI number.");

        _teeth.RemoveAll(t => !teeth.Contains(t.ToothNumber));
        foreach (var number in teeth.Where(n => _teeth.All(t => t.ToothNumber != n)))
            _teeth.Add(LaboOrderTooth.Create(Guid.NewGuid(), Id, number));
        ToothNumbers = teeth.Count == 0 ? null : string.Join(", ", teeth);
    }

    /// <summary>The round received and not checked yet, if there is one.</summary>
    private LaboOrderRound? OpenRound() =>
        LatestRound is { Outcome: LaboRoundOutcome.Pending } round ? round : null;

    /// <summary>
    /// B. Kiểm tra từng răng: one result for each tooth waiting for its check,
    /// none for any other.
    /// </summary>
    private (LaboOrderRound Round, List<LaboRoundToothResult> Checks) ValidateCheck(
        IReadOnlyCollection<LaboRoundToothResult> results)
    {
        var round = Status == LaboStatus.AwaitingCheck ? OpenRound() : null;
        if (round is null)
            throw InvalidTransition("check");

        var due = _teeth.Where(t => t.CheckResult == LaboToothCheckResult.None)
            .Select(t => t.ToothNumber).ToHashSet();
        var checks = results.GroupBy(r => r.ToothNumber).Select(g => g.Last()).ToList();
        if (checks.Any(c => !due.Contains(c.ToothNumber)))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);
        if (checks.Count != due.Count || checks.Any(c => c.Result == LaboToothCheckResult.None))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothResultsIncomplete);
        return (round, checks);
    }

    private LaboOrderTooth ToothOf(int toothNumber) =>
        _teeth.FirstOrDefault(t => t.ToothNumber == toothNumber)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);

    private void EnsureStatus(LaboStatus expected)
    {
        if (Status != expected)
            throw InvalidTransition(expected == LaboStatus.Draft ? "edit" : expected.ToString());
    }

    private BusinessException InvalidTransition(string action) =>
        new(BlueDentalDomainErrorCodes.Labo.InvalidTransition, $"Cannot {action} a labo order in status {Status}.");

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
