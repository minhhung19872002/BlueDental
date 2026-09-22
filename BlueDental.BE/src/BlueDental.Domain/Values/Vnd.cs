using System;

namespace BlueDental.Values;

/// <summary>
/// Vietnamese đồng has no minor unit: an amount is a whole number of đồng, and
/// every screen and printed sheet in the system shows it that way.
///
/// Anything that divides money therefore has to come back to a whole đồng, or
/// the repeating decimal travels: a slip-level discount of 500.000 đ spread
/// over a 2.750.000 đ slip leaves a finished 250.000 đ line worth
/// 204545,4545… and the table prints "204.545,455 đ".
/// </summary>
public static class Vnd
{
    /// <summary>
    /// The nearest whole đồng, halves away from zero — the everyday rounding a
    /// receipt is read with, and the one <c>Math.Round</c> does **not** do by
    /// default (its banker's rounding would send 0,5 to 0).
    /// </summary>
    public static decimal Round(decimal amount) =>
        decimal.Round(amount, 0, MidpointRounding.AwayFromZero);
}
