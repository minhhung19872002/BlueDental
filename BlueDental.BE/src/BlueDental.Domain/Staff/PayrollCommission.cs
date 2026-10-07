using System;
using BlueDental.Catalogs;
using BlueDental.Values;

namespace BlueDental.Staff;

/// <summary>
/// Cụm 11 mục 5 — "hoa hồng theo công đoạn": what one ticked step of a công
/// đoạn earns the dentist who performs it. The catalogue already prices every
/// step of a service ("Giá trị" + % / VNĐ on Danh mục → dịch vụ → công đoạn);
/// nothing paid it out until now.
/// </summary>
public static class PayrollCommission
{
    /// <param name="valueType">How the catalogue step is priced.</param>
    /// <param name="value">The step's "Giá trị": a percent, or VNĐ per unit.</param>
    /// <param name="stageUnits">How many units the công đoạn covers — its teeth, at least one.</param>
    /// <param name="lineQuantity">The service line's quantity: a step never pays for more units than were sold.</param>
    /// <param name="lineCharge">What the line is charged once every discount is off (before VAT).</param>
    public static decimal StepAmount(
        ServiceStageValueType valueType, decimal value, int stageUnits, int lineQuantity, decimal lineCharge)
    {
        var quantity = Math.Max(lineQuantity, 1);
        var units = Math.Min(Math.Max(stageUnits, 1), quantity);

        return valueType == ServiceStageValueType.Amount
            ? Vnd.Round(value * units)
            : Vnd.Round(lineCharge / quantity * units * value / 100m);
    }
}
