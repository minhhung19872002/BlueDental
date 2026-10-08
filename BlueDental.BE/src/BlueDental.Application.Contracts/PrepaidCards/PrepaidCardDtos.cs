using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using BlueDental.Billing;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PrepaidCards;

/// <summary>
/// Thẻ trả trước (/prepaid-card). BlueDental-local (function list cụm 3);
/// see docs/clone/pages/prepaid-card.md.
/// </summary>
public interface IPrepaidCardAppService : IApplicationService
{
    Task<ListResultDto<PrepaidCardTypeDto>> GetTypeListAsync(GetPrepaidCardTypeListInput input);
    Task<PrepaidCardTypeDto> CreateTypeAsync(SavePrepaidCardTypeDto input);
    Task<PrepaidCardTypeDto> UpdateTypeAsync(Guid id, SavePrepaidCardTypeDto input);
    Task DeleteTypeAsync(Guid id);

    Task<PagedResultDto<PrepaidCardDto>> GetListAsync(GetPrepaidCardListInput input);
    Task<PrepaidCardSummaryDto> GetSummaryAsync(GetPrepaidCardListInput input);
    Task<PrepaidCardDetailDto> GetAsync(Guid id);
    Task<PrepaidCardDetailDto> SellAsync(SellPrepaidCardDto input);
    Task<PrepaidCardDetailDto> TopupAsync(Guid id, TopupPrepaidCardDto input);
    Task<PrepaidCardDetailDto> SetMembersAsync(Guid id, SetPrepaidCardMembersDto input);
    Task<PrepaidCardDetailDto> LockAsync(Guid id);
    Task<PrepaidCardDetailDto> UnlockAsync(Guid id);

    /// <summary>Cards a patient may pay with right now — the payment dialog's picker.</summary>
    Task<ListResultDto<PrepaidCardDto>> GetUsableAsync(Guid patientId);
}

public class GetPrepaidCardTypeListInput
{
    public Guid? ClinicBranchId { get; set; }
    public string? Filter { get; set; }

    /// <summary>Only types still on sale — the "Bán thẻ" picker.</summary>
    public bool OnSaleOnly { get; set; }
}

public class PrepaidCardTypeDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal SalePrice { get; set; }
    public decimal UsageValue { get; set; }
    public int? MaxUses { get; set; }
    public PrepaidCardCommissionType CommissionType { get; set; }
    public decimal CommissionValue { get; set; }
    public bool AllowFamily { get; set; }
    public List<Guid> ServiceIds { get; set; } = new();
    public List<Guid> ServiceGroupIds { get; set; } = new();
    public bool IsOnSale { get; set; }
    public string? Note { get; set; }

    /// <summary>Cards sold from this type, deleted ones excluded.</summary>
    public int SoldCount { get; set; }

    public DateTime CreationTime { get; set; }
}

public class SavePrepaidCardTypeDto
{
    /// <summary>Branch of a new type; ignored on update. Defaults to the caller's branch.</summary>
    public Guid? ClinicBranchId { get; set; }

    [Required]
    [StringLength(PrepaidCardConsts.MaxNameLength)]
    public string Name { get; set; } = string.Empty;

    public decimal SalePrice { get; set; }
    public decimal UsageValue { get; set; }
    public int? MaxUses { get; set; }
    public PrepaidCardCommissionType CommissionType { get; set; } = PrepaidCardCommissionType.Percent;
    public decimal CommissionValue { get; set; }
    public bool AllowFamily { get; set; }
    public List<Guid> ServiceIds { get; set; } = new();
    public List<Guid> ServiceGroupIds { get; set; } = new();
    public bool IsOnSale { get; set; } = true;

    [StringLength(PrepaidCardConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

public class GetPrepaidCardListInput : PagedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Mã thẻ, or the owner's name / patient code.</summary>
    public string? Filter { get; set; }

    public Guid? CardTypeId { get; set; }

    /// <summary>Cards the patient owns or is a member of.</summary>
    public Guid? PatientId { get; set; }

    public PrepaidCardListState? State { get; set; }
}

/// <summary>The status filter of the card list: the stored status plus the two read off the figures.</summary>
public enum PrepaidCardListState
{
    /// <summary>Active with value and uses left.</summary>
    Usable = 1,
    Locked = 2,
    /// <summary>Active but nothing left to spend, or no use left.</summary>
    Exhausted = 3,
}

public class PrepaidCardDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid CardTypeId { get; set; }
    public string Name { get; set; } = string.Empty;

    public Guid OwnerPatientId { get; set; }
    public string? OwnerName { get; set; }
    public string? OwnerCode { get; set; }

    public bool AllowFamily { get; set; }
    public List<PrepaidCardMemberDto> Members { get; set; } = new();

    public decimal SalePrice { get; set; }
    public decimal UsageValue { get; set; }
    public decimal TotalLoaded { get; set; }
    public decimal Balance { get; set; }
    public int? MaxUses { get; set; }
    public int UsedCount { get; set; }
    public int? RemainingUses { get; set; }

    public List<Guid> ServiceIds { get; set; } = new();
    public List<Guid> ServiceGroupIds { get; set; } = new();

    public Guid SellerStaffId { get; set; }
    public string? SellerName { get; set; }
    public decimal CommissionAmount { get; set; }

    public DateTimeOffset SoldAt { get; set; }
    public PrepaidCardStatus Status { get; set; }
    public bool IsExhausted { get; set; }
    public string? Note { get; set; }
}

public class PrepaidCardMemberDto
{
    public Guid PatientId { get; set; }
    public string? Name { get; set; }
    public string? Code { get; set; }
}

public class PrepaidCardDetailDto : PrepaidCardDto
{
    /// <summary>Newest first, each with the balance it left behind.</summary>
    public List<PrepaidCardTransactionDto> Transactions { get; set; } = new();
}

public class PrepaidCardTransactionDto : EntityDto<Guid>
{
    public int Sequence { get; set; }
    public PrepaidCardTransactionType Type { get; set; }
    public decimal Value { get; set; }
    public decimal BalanceAfter { get; set; }
    public decimal PaidAmount { get; set; }
    public PaymentMethodKind? Method { get; set; }
    public Guid? PatientId { get; set; }
    public string? PatientName { get; set; }
    public Guid? PatientPaymentId { get; set; }
    public string? PatientPaymentCode { get; set; }
    public string? StaffName { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? Note { get; set; }
}

/// <summary>The tiles above the card list.</summary>
public class PrepaidCardSummaryDto
{
    public int CardCount { get; set; }
    public int UsableCount { get; set; }

    /// <summary>Value still to be spent on every card — what the clinic owes in services.</summary>
    public decimal OutstandingBalance { get; set; }

    /// <summary>Money taken for cards: sales plus top-ups.</summary>
    public decimal MoneyReceived { get; set; }

    public decimal CommissionTotal { get; set; }
}

public class SellPrepaidCardDto
{
    public Guid CardTypeId { get; set; }

    /// <summary>Selling branch; defaults to the caller's branch.</summary>
    public Guid? ClinicBranchId { get; set; }

    public Guid OwnerPatientId { get; set; }
    public List<Guid> MemberPatientIds { get; set; } = new();
    public Guid SellerStaffId { get; set; }
    public DateTimeOffset? SoldAt { get; set; }
    public PaymentMethodKind Method { get; set; } = PaymentMethodKind.Cash;

    /// <summary>Required when Method is Banking or EWallet.</summary>
    public Guid? PaymentAccountId { get; set; }

    [StringLength(PrepaidCardConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

public class TopupPrepaidCardDto
{
    /// <summary>Usage value added to the card.</summary>
    public decimal Value { get; set; }

    /// <summary>Money taken for it; defaults to <see cref="Value"/>.</summary>
    public decimal? PaidAmount { get; set; }

    public PaymentMethodKind Method { get; set; } = PaymentMethodKind.Cash;
    public Guid? PaymentAccountId { get; set; }
    public DateTimeOffset? OccurredAt { get; set; }

    [StringLength(PrepaidCardConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

public class SetPrepaidCardMembersDto
{
    public List<Guid> MemberPatientIds { get; set; } = new();
}
