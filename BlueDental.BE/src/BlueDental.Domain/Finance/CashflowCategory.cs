using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Finance;

/// <summary>
/// Mục thu / mục chi — the category picked on a cash voucher, and the category
/// list on the "Danh mục" sub-tab of both cashflow report tabs.
///
/// Reference permissions: <c>reportCashflowCategory</c> and
/// <c>reportTransferCategory</c>; <see cref="AppliesToTransfers"/> tells the two apart.
/// </summary>
public class CashflowCategory : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>Income or expense category.</summary>
    public SalesEntryType Type { get; private set; }

    /// <summary>True for cash-management (Luân chuyển dòng tiền) categories.</summary>
    public bool AppliesToTransfers { get; private set; }

    /// <summary>System categories cannot be renamed or deleted.</summary>
    public bool IsSystem { get; private set; }

    public bool IsActive { get; private set; }

    public int SortOrder { get; private set; }

    public string? Description { get; private set; }

    protected CashflowCategory() { }

    public static CashflowCategory Create(
        Guid id,
        Guid clinicBranchId,
        string name,
        SalesEntryType type,
        bool appliesToTransfers = false,
        bool isSystem = false,
        int sortOrder = 0,
        string? description = null)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        return new CashflowCategory
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Name = name,
            Type = type,
            AppliesToTransfers = appliesToTransfers,
            IsSystem = isSystem,
            IsActive = true,
            SortOrder = sortOrder,
            Description = description
        };
    }

    public CashflowCategory Rename(string name)
    {
        GuardNotSystem();
        Check.NotNullOrWhiteSpace(name, nameof(name));
        Name = name;
        return this;
    }

    public CashflowCategory UpdateDescription(string? description)
    {
        Description = description;
        return this;
    }

    public CashflowCategory Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    public CashflowCategory Activate()
    {
        IsActive = true;
        return this;
    }

    public CashflowCategory Deactivate()
    {
        GuardNotSystem();
        IsActive = false;
        return this;
    }

    private void GuardNotSystem()
    {
        if (IsSystem)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Finance.SystemCategoryLocked,
                "A system cashflow category cannot be modified.");
        }
    }
}
