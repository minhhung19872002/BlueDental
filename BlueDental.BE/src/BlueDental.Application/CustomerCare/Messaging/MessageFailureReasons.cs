using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Localization;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// What <see cref="MessageSendJob"/> writes on a message it could not send.
/// The log keeps it in English, as stored; Thống kê CSKH (F-78) and Kết quả
/// lần gửi (F-79) say it in the viewer's language through <see cref="Describe"/>.
/// A Zalo refusal whose code is known is said in plain words (BA P2210);
/// any other provider refusal is shown as the provider worded it.
/// </summary>
public static partial class MessageFailureReasons
{
    public const string CustomerNotFound = "Customer not found.";
    public const string SendError = "Send error.";
    public const string TemplateNotReady = "The template is no longer ready to send.";
    public const string ZaloNotConnected = "Zalo OA is not connected.";
    public const string NoPhone = "No phone number Zalo accepts.";

    private const string MissingDataPrefix = "Missing data: ";
    private const string TemplateUnreadablePrefix = "Zalo template could not be read: ";

    private static readonly Dictionary<string, string> Fixed = new(StringComparer.Ordinal)
    {
        [CustomerNotFound] = "CSKH:Stats:Error:NoCustomer",
        [SendError] = "CSKH:Stats:Error:SendError",
        [TemplateNotReady] = "CSKH:Stats:Error:TemplateNotReady",
        [ZaloNotConnected] = "CSKH:Stats:Error:ZaloNotConnected",
        [NoPhone] = "CSKH:Stats:Error:NoPhone",
    };

    /// <summary>ZNS send refusals by Zalo's error code (<see cref="Zalo.HttpZaloApiClient.ReadEnvelope"/> words them "… (code)").</summary>
    private static readonly Dictionary<string, string> ZaloCodes = new(StringComparer.Ordinal)
    {
        ["-108"] = "CSKH:Stats:Error:Zalo:InvalidPhone",
        ["-118"] = "CSKH:Stats:Error:Zalo:NoAccount",
        ["-139"] = "CSKH:Stats:Error:Zalo:Refused",
        ["-141"] = "CSKH:Stats:Error:Zalo:Refused",
        ["-114"] = "CSKH:Stats:Error:Zalo:CannotReceive",
        ["-119"] = "CSKH:Stats:Error:Zalo:CannotReceive",
        ["-115"] = "CSKH:Stats:Error:Zalo:Quota",
        ["-144"] = "CSKH:Stats:Error:Zalo:Quota",
        ["-147"] = "CSKH:Stats:Error:Zalo:Quota",
    };

    public static string MissingData(IEnumerable<string> missing) => MissingDataPrefix + string.Join(", ", missing);

    public static string TemplateUnreadable(object? detail) => TemplateUnreadablePrefix + detail;

    public static string? Describe(string? stored, IStringLocalizer l)
    {
        if (string.IsNullOrWhiteSpace(stored))
        {
            return null;
        }

        if (Fixed.TryGetValue(stored, out var key))
        {
            return l[key];
        }

        if (stored.StartsWith(MissingDataPrefix, StringComparison.Ordinal))
        {
            return l["CSKH:Stats:Error:MissingData", stored[MissingDataPrefix.Length..]];
        }

        if (stored.StartsWith(TemplateUnreadablePrefix, StringComparison.Ordinal))
        {
            return l["CSKH:Stats:Error:TemplateUnreadable", stored[TemplateUnreadablePrefix.Length..]];
        }

        return ZaloCode().Match(stored) is { Success: true } code && ZaloCodes.TryGetValue(code.Groups[1].Value, out var zalo)
            ? l[zalo]
            : stored;
    }

    [GeneratedRegex(@"(?:^Zalo error |\()(-\d+)\)?$")]
    private static partial Regex ZaloCode();
}
