using System;
using System.Collections.Generic;
using System.Linq;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;
using BlueDental.Values;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Phiếu điều trị — a patient's treatment plan and the service lines it holds.
///
/// The reference calls this <c>patient-treatments</c>: a numbered slip (DT01) that
/// carries a status, a progress percentage, a plan-level discount and a money
/// rollup, plus the <c>treatmentServices[]</c> it is made of. It has **no approval
/// step** — a slip opened from accepted consulting lines starts in progress.
///
/// BlueDental keeps a second, manual path (Draft → PendingApproval → Approved →
/// InProgress) for plans built by hand; that path is BlueDental's own.
/// </summary>
public class TreatmentPlan : FullAuditedAggregateRoot<Guid>
{
    private readonly List<TreatmentService> _services = new();
    private readonly List<TreatmentPlanVoucher> _appliedVouchers = new();

    public Guid PatientId { get; private set; }
    public Guid DentistId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Title { get; private set; } = default!;
    public string? Description { get; private set; }
    public TreatmentPlanStatus Status { get; private set; }
    public DateOnly? EstimatedCompletionDate { get; private set; }
    public string? ApprovalNotes { get; private set; }
    public Guid? ApprovedBy { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }

    /// <summary>Slip number shown in the UI — "DT01", numbered per patient.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Nhân sự tư vấn, separate from the receiving dentist.</summary>
    public Guid? ConsultantStaffId { get; private set; }

    /// <summary>Discount applied to the whole slip, on top of any line discount.</summary>
    public DiscountType DiscountType { get; private set; }

    public decimal DiscountValue { get; private set; }

    /// <summary>
    /// Sum of the vouchers redeemed on the slip, worked out by the server when
    /// the slip opened — see <see cref="AppliedVouchers"/>.
    /// </summary>
    public decimal? VoucherDiscountAmount { get; private set; }

    public IReadOnlyCollection<TreatmentService> Services => _services.AsReadOnly();

    /// <summary>The reference's <c>appliedCoupons[]</c>: what each voucher took off.</summary>
    public IReadOnlyCollection<TreatmentPlanVoucher> AppliedVouchers => _appliedVouchers.AsReadOnly();

    /// <summary>
    /// Lines that still count towards the slip's money.
    ///
    /// A cancelled line was never charged. A "BE:Status:Converted" line has been replaced
    /// by a newer one on the same slip, and an "BE:Status:Transferred" line has moved to
    /// another slip — charging either here would bill the same work twice.
    /// Measured on the reference 2026-09-21: DT33 holds a 1.000.000 đ line plus
    /// a 909.091 đ <c>replaced</c> one and reports <c>totalPrice: 1000000</c>.
    /// </summary>
    private IEnumerable<TreatmentService> CountedServices =>
        _services.Where(s => !UnchargedStatuses.Contains(s.Status));

    private static readonly TreatmentServiceStatus[] UnchargedStatuses =
    [
        TreatmentServiceStatus.Cancelled,
        TreatmentServiceStatus.Replaced,
        TreatmentServiceStatus.Transferred
    ];

    /// <summary>Sum of the line amounts before the slip-level discount.</summary>
    public decimal ServicesTotal => CountedServices.Sum(s => s.CountedAmount);

    /// <summary>
    /// Sum of the lines at their giá gốc, before ANY discount: the
    /// "BE:Field:TotalAmount" the payment dialog opens with, so a 50.000 đ line
    /// discount reads as 250.000 − 50.000 rather than vanishing into a 200.000
    /// total (R-586), and a unit price lowered from 1.000.000 to 910.000 reads
    /// as 1.000.000 − 90.000 — the reference's <c>payment.discount</c>.
    /// </summary>
    public decimal ServicesGrossTotal => CountedServices.Sum(s => s.ListAmount);

    /// <summary>
    /// "Giảm dịch vụ" of the lines that still count — a lowered unit price plus
    /// any carried-over line discount. A cancelled line was never charged, so
    /// its discount must not swell the slip's "BE:Common:Discount" either.
    /// </summary>
    public decimal ServicesDiscountAmount => CountedServices.Sum(s => s.ServiceDiscountAmount);

    /// <summary>Slip-level discount, capped at the slip total.</summary>
    public decimal PlanDiscountAmount => Math.Min(OwnDiscountUncapped + (VoucherDiscountAmount ?? 0m), ServicesTotal);

    /// <summary>The slip's own %/money discount, before the cap.</summary>
    public decimal OwnDiscountUncapped => DiscountType switch
    {
        DiscountType.Money => DiscountValue,
        DiscountType.Percentage => Vnd.Round(ServicesTotal * DiscountValue / 100m),
        _ => 0m
    };

    /// <summary>
    /// The voucher part of <see cref="PlanDiscountAmount"/> ("Voucher KHDT").
    /// When the cap bites, the voucher keeps what it can and the slip's own
    /// discount gives way — a voucher is the patient's, fixed when it was
    /// redeemed.
    /// </summary>
    public decimal PlanVoucherAmount => Math.Min(VoucherDiscountAmount ?? 0m, PlanDiscountAmount);

    /// <summary>Every discount on the slip: the lines' own plus the slip level and voucher.</summary>
    public decimal TotalDiscountAmount => ServicesDiscountAmount + PlanDiscountAmount;

    /// <summary>What the patient actually owes for this slip.</summary>
    public decimal TotalAmount => ServicesTotal - PlanDiscountAmount;

    /// <summary>
    /// The slip-level discount (voucher included) spread over the counted lines
    /// in proportion to what each is worth, in whole đồng, and adding up to
    /// <see cref="PlanDiscountAmount"/> exactly: the rounding leftover lands on
    /// the largest line, which can always absorb it.
    ///
    /// Lines that are not counted (cancelled, replaced, transferred) get no share.
    /// </summary>
    public IReadOnlyDictionary<Guid, decimal> DiscountShares()
    {
        var shares = new Dictionary<Guid, decimal>();
        var total = ServicesTotal;
        if (total == 0m)
        {
            return shares;
        }

        var discount = PlanDiscountAmount;
        var counted = CountedServices.ToList();
        foreach (var line in counted)
        {
            shares[line.Id] = Vnd.Round(discount * line.CountedAmount / total);
        }

        var leftover = discount - shares.Values.Sum();
        if (leftover != 0m)
        {
            var largest = counted.OrderByDescending(s => s.CountedAmount).First();
            shares[largest.Id] += leftover;
        }

        return shares;
    }

    /// <summary>
    /// What the patient is actually charged for one line once the slip-level
    /// discount is taken off it — the amount a receipt may collect against the
    /// line. Summed over the counted lines this is <see cref="TotalAmount"/>, so
    /// paying every line in full can never overshoot the slip (BA item 23: a
    /// voucher slip was collected at its pre-voucher price).
    /// </summary>
    public decimal ChargedAmountOf(TreatmentService line)
    {
        if (UnchargedStatuses.Contains(line.Status))
        {
            return 0m;
        }

        return line.CountedAmount - DiscountShares().GetValueOrDefault(line.Id);
    }

    /// <summary>
    /// The line's VAT: its "% thuế" on what it is charged once every discount is
    /// off — the base the catalog's "Thực thu gồm VAT" uses (giá sau giảm × thuế).
    /// </summary>
    public decimal TaxAmountOf(TreatmentService line) =>
        line.TaxPercent == 0m ? 0m : Vnd.Round(ChargedAmountOf(line) * line.TaxPercent / 100m);

    /// <summary>
    /// What the patient pays for the line, VAT included — the most a receipt may
    /// collect on it. <see cref="ChargedAmountOf"/> stays the pre-VAT revenue figure.
    /// </summary>
    public decimal PayableAmountOf(TreatmentService line) => ChargedAmountOf(line) + TaxAmountOf(line);

    /// <summary>Σ of the counted lines' VAT.</summary>
    public decimal TaxAmount => CountedServices.Sum(TaxAmountOf);

    /// <summary>What the patient pays for the slip, VAT included: <see cref="TotalAmount"/> + <see cref="TaxAmount"/>.</summary>
    public decimal PayableAmount => TotalAmount + TaxAmount;

    /// <summary>
    /// Each line's <see cref="DiscountShares"/> split the way the reference's
    /// "Tổng giảm giá" tooltip prints it: <c>Own</c> is "Giảm KHDT"
    /// (<c>khdtDiscount</c>) and <c>Voucher</c> is "Voucher KHDT"
    /// (<c>khdtVoucher</c>). The two add up to the line's share, so the
    /// charged amounts never move; the voucher parts add up to
    /// <see cref="PlanVoucherAmount"/>, the rounding leftover again on the
    /// largest share.
    /// </summary>
    public IReadOnlyDictionary<Guid, (decimal Own, decimal Voucher)> DiscountShareParts()
    {
        var shares = DiscountShares();
        var planDiscount = PlanDiscountAmount;
        var voucher = PlanVoucherAmount;

        var voucherParts = shares.ToDictionary(
            pair => pair.Key,
            pair => planDiscount == 0m ? 0m : Vnd.Round(pair.Value * voucher / planDiscount));

        var leftover = voucher - voucherParts.Values.Sum();
        if (leftover != 0m && shares.Count > 0)
        {
            var largest = shares.OrderByDescending(pair => pair.Value).First().Key;
            voucherParts[largest] += leftover;
        }

        return shares.ToDictionary(
            pair => pair.Key,
            pair =>
            {
                var part = Math.Clamp(voucherParts[pair.Key], 0m, pair.Value);
                return (Own: pair.Value - part, Voucher: part);
            });
    }

    /// <summary>Value of the lines already finished — drives Phải thu.</summary>
    public decimal CompletedValue
    {
        get
        {
            if (ServicesTotal == 0m)
            {
                return 0m;
            }

            // The finished lines at what they are charged after the slip
            // discount, in whole đồng per line (R-459), so Phải thu and the
            // lines' own Còn nợ are read off the same shares.
            var shares = DiscountShares();
            return CountedServices
                .Where(s => s.IsCompleted)
                .Sum(s => s.CountedAmount - shares.GetValueOrDefault(s.Id));
        }
    }

    /// <summary>Tiến độ: finished lines over counted lines, 0-100.</summary>
    public int ProgressPercent
    {
        get
        {
            var counted = CountedServices.Count();
            if (counted == 0)
            {
                return 0;
            }

            return CountedServices.Count(s => s.IsCompleted) * 100 / counted;
        }
    }

    protected TreatmentPlan() { }

    public TreatmentPlan(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        string title,
        string? description = null,
        DateOnly? estimatedCompletionDate = null)
        : base(id)
    {
        PatientId = patientId;
        DentistId = dentistId;
        BranchId = branchId;
        Title = title;
        Description = description;
        EstimatedCompletionDate = estimatedCompletionDate;
        Status = TreatmentPlanStatus.Draft;
    }

    /// <summary>
    /// Opens a slip straight from accepted consulting lines, the way the reference
    /// does it — no approval step, in progress from the start.
    /// </summary>
    public static TreatmentPlan Open(
        Guid id,
        Guid patientId,
        Guid dentistId,
        Guid branchId,
        string code,
        string title,
        Guid? consultantStaffId = null,
        DiscountType discountType = DiscountType.None,
        decimal discountValue = 0m)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code));
        Check.NotNullOrWhiteSpace(title, nameof(title));

        return new TreatmentPlan
        {
            Id = id,
            PatientId = patientId,
            DentistId = dentistId,
            BranchId = branchId,
            Code = code,
            Title = title,
            ConsultantStaffId = consultantStaffId,
            DiscountType = discountType,
            DiscountValue = discountValue,
            Status = TreatmentPlanStatus.InProgress
        };
    }

    /// <summary>Pulls one accepted consulting line into the slip as a service line.</summary>
    public TreatmentService AddService(
        Guid serviceLineId,
        Guid serviceId,
        Guid? sourceAdviseId,
        decimal price,
        int quantity,
        DiscountType discountType,
        decimal discountValue,
        IEnumerable<ToothSelection>? teeth = null,
        decimal? originalPrice = null)
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"No service line can be added to a plan in status {Status}.");
        }

        if (sourceAdviseId.HasValue && _services.Any(s => s.SourceAdviseId == sourceAdviseId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidAdviseTransition,
                "That consulting line is already on this plan.");
        }

        var line = TreatmentService.FromAdvise(
            serviceLineId,
            Id,
            PatientId,
            BranchId,
            serviceId,
            sourceAdviseId,
            $"{Code}-{_services.Count + 1:D2}",
            price,
            quantity,
            discountType,
            discountValue,
            teeth,
            originalPrice);

        _services.Add(line);
        return line;
    }

    /// <summary>
    /// Moves one service line to a 1-based position on the slip and renumbers
    /// the rest, which is what dragging a row does on the reference.
    ///
    /// A line is born without a position (<c>SortOrder = 0</c>) so that an
    /// untouched slip keeps the reference's default order — newest first. The
    /// first drag numbers every line on the slip, and they stay numbered.
    ///
    /// The position is clamped rather than rejected: a client that dropped onto
    /// a row cancelled in the meantime still lands somewhere sensible.
    ///
    /// Allowed on a closed slip too — the order is how the clinic reads the
    /// slip, not a change to the treatment or to any money on it.
    /// </summary>
    public TreatmentPlan ReorderService(Guid serviceLineId, int sortOrder)
    {
        var moved = GetService(serviceLineId);

        // The same order the slip is read in, or a drop would be measured
        // against a list the clinic never saw.
        var sequence = _services
            .OrderBy(s => s.SortOrder)
            .ThenByDescending(s => s.CreationTime)
            .ToList();

        sequence.Remove(moved);
        var target = Math.Clamp(sortOrder, 1, sequence.Count + 1);
        sequence.Insert(target - 1, moved);

        for (var index = 0; index < sequence.Count; index++)
        {
            sequence[index].Reorder(index + 1);
        }

        return this;
    }

    /// <summary>
    /// "Chuyển đổi dịch vụ": closes one line and writes the line that takes its
    /// place, the two pointing at each other.
    ///
    /// <paramref name="chargeAmount"/> is the reference's editable "BE:Common:Payment"
    /// field — what the patient is actually charged for the new service. It is
    /// carried as a money discount off the catalog price so the new line still
    /// shows its real "BE:Field:UnitPrice", which is how the reference prints it.
    /// </summary>
    public TreatmentService ConvertService(
        Guid serviceLineId,
        Guid newLineId,
        Guid newServiceId,
        decimal unitPrice,
        int quantity,
        decimal chargeAmount,
        IEnumerable<ToothSelection>? teeth = null)
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"No service line can be converted on a plan in status {Status}.");
        }

        var old = GetService(serviceLineId);
        var gross = unitPrice * quantity;

        if (chargeAmount < 0m || chargeAmount > gross)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.NegativePaymentAmount,
                "The amount charged for the new service must sit between zero and its price.");
        }

        var line = TreatmentService.FromAdvise(
            newLineId,
            Id,
            PatientId,
            BranchId,
            newServiceId,
            sourceAdviseId: null,
            $"{Code}-{_services.Count + 1:D2}",
            unitPrice,
            quantity,
            DiscountType.Money,
            gross - chargeAmount,
            teeth);

        old.MarkReplaced().LinkReplacement(line.Id);
        line.LinkReplacement(old.Id);
        _services.Add(line);

        return line;
    }

    public TreatmentService GetService(Guid serviceLineId)
    {
        var line = _services.FirstOrDefault(s => s.Id == serviceLineId);
        if (line == null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "That service line does not belong to this plan.");
        }

        return line;
    }

    /// <summary>Applies a discount to the whole slip.</summary>
    public TreatmentPlan ApplyDiscount(DiscountType discountType, decimal discountValue)
    {
        if (discountValue < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "A discount cannot be negative.");
        }

        if (discountType == DiscountType.Percentage && discountValue > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "A percentage discount cannot exceed 100.");
        }

        DiscountType = discountType;
        DiscountValue = discountValue;
        return this;
    }

    /// <summary>
    /// The voucher taken off the whole slip, on top of any slip discount — see
    /// <see cref="PlanDiscountAmount"/>, which adds the two and caps the sum at
    /// the slip total. Held apart from <see cref="DiscountValue"/> because the
    /// two have different reasons and the reference reports them separately.
    ///
    /// Sets the figure without redeeming anything; the path a client takes is
    /// <see cref="RedeemVouchers"/>, which burns a use on each voucher.
    /// </summary>
    public TreatmentPlan ApplyVoucher(decimal? voucherDiscountAmount)
    {
        if (voucherDiscountAmount is < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidDiscount,
                "Voucher discount must not be negative.");
        }

        VoucherDiscountAmount = voucherDiscountAmount;
        return this;
    }

    /// <summary>
    /// Burns one use on each voucher and pins what it took off the slip, the
    /// way staging's <c>POST /voucher/apply</c> does when a slip opens (BA
    /// item 24, measured 2026-09-28): the voucher's "Lượt dùng" moves at this
    /// moment and never moves back.
    ///
    /// Only a slip that has its lines can redeem — the discount is measured
    /// against <see cref="ServicesTotal"/>, so call this after the lines are
    /// on. A slip redeems once; there is no second round.
    ///
    /// Plan-side rules, checked before any use is burnt so a refused pick
    /// leaves every voucher untouched:
    /// <list type="bullet">
    /// <item>every voucher must be scoped to the whole plan and to this
    /// branch (or to every branch);</item>
    /// <item>an exclusive voucher stands alone;</item>
    /// <item>a voucher with a per-customer cap refuses once this patient has
    /// already carried it that many times — <paramref name="priorUsesByPatient"/>
    /// is the count of this patient's earlier slips per voucher.</item>
    /// </list>
    /// The voucher-side rules (published, in its dates, uses left, minimum
    /// order) are the voucher's own, in <see cref="Voucher.Redeem"/>.
    /// </summary>
    public TreatmentPlan RedeemVouchers(
        IReadOnlyList<Voucher> vouchers,
        IReadOnlyDictionary<Guid, int> priorUsesByPatient,
        DateOnly onDate,
        Func<Guid> newId)
    {
        Check.NotNull(vouchers, nameof(vouchers));
        Check.NotNull(priorUsesByPatient, nameof(priorUsesByPatient));
        Check.NotNull(newId, nameof(newId));

        if (vouchers.Count == 0)
        {
            return this;
        }

        if (_appliedVouchers.Count > 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                "This slip already carries its vouchers.");
        }

        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"No voucher can be redeemed on a plan in status {Status}.");
        }

        if (vouchers.Select(v => v.Id).Distinct().Count() != vouchers.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                "The same voucher cannot be applied twice to one slip.");
        }

        if (vouchers.Count > 1 && vouchers.Any(v => v.IsExclusive))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                "An exclusive voucher cannot be combined with another voucher.");
        }

        var orderAmount = ServicesTotal;
        foreach (var voucher in vouchers)
        {
            if (voucher.ScopeTarget != VoucherScopeTarget.Treatment)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                    $"Voucher {voucher.Code} is not scoped to the whole plan.");
            }

            if (voucher.ClinicBranchId.HasValue && voucher.ClinicBranchId.Value != BranchId)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                    $"Voucher {voucher.Code} belongs to another branch.");
            }

            if (!voucher.IsAvailableFor(onDate, orderAmount))
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Promotions.VoucherNotApplicable,
                    $"Voucher {voucher.Code} cannot be applied to this slip.");
            }

            if (voucher.PerCustomerLimit.HasValue
                && priorUsesByPatient.GetValueOrDefault(voucher.Id) >= voucher.PerCustomerLimit.Value)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Promotions.VoucherPerCustomerLimitReached,
                    $"This patient has already used voucher {voucher.Code} {voucher.PerCustomerLimit} time(s).");
            }
        }

        var total = 0m;
        foreach (var voucher in vouchers)
        {
            var amount = Vnd.Round(voucher.Redeem(onDate, orderAmount));
            _appliedVouchers.Add(TreatmentPlanVoucher.FromVoucher(newId(), Id, voucher, amount));
            total += amount;
        }

        VoucherDiscountAmount = total > orderAmount ? orderAmount : total;
        return this;
    }

    /// <summary>Closes the slip once every counted line is finished.</summary>
    public TreatmentPlan CloseIfAllServicesDone()
    {
        if (Status != TreatmentPlanStatus.InProgress)
        {
            return this;
        }

        if (CountedServices.Any() && CountedServices.All(s => s.IsCompleted))
        {
            Status = TreatmentPlanStatus.Completed;
        }

        return this;
    }

    /// <summary>
    /// Re-opens a closed slip once one of its lines is back at work — the
    /// counterpart of <see cref="CloseIfAllServicesDone"/>, for when a công đoạn
    /// is re-opened on a line the slip had already counted as finished.
    /// </summary>
    public TreatmentPlan ReopenIfAnyServiceActive()
    {
        if (Status != TreatmentPlanStatus.Completed)
        {
            return this;
        }

        if (CountedServices.Any(s => !s.IsCompleted))
        {
            Status = TreatmentPlanStatus.InProgress;
        }

        return this;
    }

    public TreatmentPlan SubmitForApproval()
    {
        EnsureStatus(TreatmentPlanStatus.Draft, nameof(SubmitForApproval));
        Status = TreatmentPlanStatus.PendingApproval;
        return this;
    }

    public TreatmentPlan Approve(Guid approvedBy, string? notes = null)
    {
        EnsureStatus(TreatmentPlanStatus.PendingApproval, nameof(Approve));
        Status = TreatmentPlanStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTimeOffset.UtcNow;
        ApprovalNotes = notes;
        return this;
    }

    public TreatmentPlan Start()
    {
        EnsureStatus(TreatmentPlanStatus.Approved, nameof(Start));
        Status = TreatmentPlanStatus.InProgress;
        return this;
    }

    public TreatmentPlan Complete()
    {
        EnsureStatus(TreatmentPlanStatus.InProgress, nameof(Complete));
        Status = TreatmentPlanStatus.Completed;
        return this;
    }

    public TreatmentPlan Cancel()
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot cancel a treatment plan in status {Status}.");
        }

        Status = TreatmentPlanStatus.Cancelled;
        return this;
    }

    private void EnsureStatus(TreatmentPlanStatus expected, string operation)
    {
        if (Status != expected)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.InvalidPlanTransition,
                $"Cannot perform '{operation}' on plan with status '{Status}'. Expected '{expected}'.");
        }
    }
    public TreatmentPlan Update(string title, string? description, DateOnly? estimatedCompletionDate)
    {
        EnsureStatus(TreatmentPlanStatus.Draft, nameof(Update));
        Check.NotNullOrWhiteSpace(title, nameof(title));
        Title = title;
        Description = description;
        EstimatedCompletionDate = estimatedCompletionDate;
        return this;
    }

}
