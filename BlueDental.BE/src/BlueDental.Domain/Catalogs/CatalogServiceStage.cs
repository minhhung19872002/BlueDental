using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One "BE:Common:StagesLower" of a service — a step of the treatment the doctor is paid
/// against. Reference: the table inside the service dialog's "BE:Common:Stage" tab.
/// </summary>
public class CatalogServiceStage : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// "BE:Field:Value" — a share of the service price when <see cref="ValueType"/>
    /// is <see cref="ServiceStageValueType.Percentage"/>, an amount in VNĐ otherwise.
    /// </summary>
    public decimal Value { get; private set; }

    /// <summary>The reference's "%" / "VNĐ" switch in front of the value.</summary>
    public ServiceStageValueType ValueType { get; private set; }

    /// <summary>The reference's star — "Tính lương cho phòng MKT".</summary>
    public bool IsMarketingSalary { get; private set; }

    public int SortOrder { get; private set; }

    protected CatalogServiceStage() { }

    public CatalogServiceStage(
        Guid id,
        Guid catalogEntryId,
        string name,
        decimal value,
        ServiceStageValueType valueType,
        bool isMarketingSalary,
        int sortOrder)
        : base(id)
    {
        CatalogEntryId = catalogEntryId;
        Revise(name, value, valueType, isMarketingSalary, sortOrder);
    }

    /// <summary>
    /// The same step, edited in place: its id is what every công đoạn that
    /// ticked it points at, so an edit must never mint a new one.
    /// </summary>
    internal void Revise(string name, decimal value, ServiceStageValueType valueType, bool isMarketingSalary, int sortOrder)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (value < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidStageValue,
                "A stage value cannot be negative.");
        }

        if (valueType == ServiceStageValueType.Percentage && value > 100m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidStageValue,
                "A percentage stage cannot be worth more than 100.");
        }

        Name = name;
        Value = value;
        ValueType = valueType;
        IsMarketingSalary = isMarketingSalary;
        SortOrder = sortOrder;
    }
}
