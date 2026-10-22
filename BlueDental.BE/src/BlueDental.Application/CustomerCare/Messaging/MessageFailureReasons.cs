using System;
using System.Collections.Generic;
using Microsoft.Extensions.Localization;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// What <see cref="MessageSendJob"/> writes on a message it could not send.
/// The log keeps it in English, as stored; Thống kê CSKH (F-78) says it in the
/// viewer's language through <see cref="Describe"/>. A provider's own refusal
/// is shown as the provider worded it.
/// </summary>
public static class MessageFailureReasons
{
    public const string CustomerNotFound = "Customer not found.";
    public const string SendError = "Send error.";
    public const string TemplateNotReady = "The template is no longer ready to send.";
    public const string ZaloNotConnected = "Zalo OA is not connected.";

    private const string MissingDataPrefix = "Missing data: ";
    private const string TemplateUnreadablePrefix = "Zalo template could not be read: ";

    private static readonly Dictionary<string, string> Fixed = new(StringComparer.Ordinal)
    {
        [CustomerNotFound] = "CSKH:Stats:Error:NoCustomer",
        [SendError] = "CSKH:Stats:Error:SendError",
        [TemplateNotReady] = "CSKH:Stats:Error:TemplateNotReady",
        [ZaloNotConnected] = "CSKH:Stats:Error:ZaloNotConnected",
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

        return stored.StartsWith(TemplateUnreadablePrefix, StringComparison.Ordinal)
            ? l["CSKH:Stats:Error:TemplateUnreadable", stored[TemplateUnreadablePrefix.Length..]]
            : stored;
    }
}
