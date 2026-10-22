using System;
using System.Collections.Generic;
using BlueDental.Exporting;
using BlueDental.Tools;
using Microsoft.Extensions.Localization;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// "Xuất báo cáo Excel" of Thống kê CSKH (F-78): one sheet per table of the
/// page, every header and label in the viewer's language, times on the clinic's clock.
/// </summary>
internal sealed class MessageStatsExcel(IStringLocalizer l, DateOnly from, DateOnly to)
{
    public byte[] Build(
        IReadOnlyCollection<MessageStatsDayDto> days,
        IReadOnlyCollection<MessageStatsTemplateDto> templates,
        IReadOnlyCollection<MessageStatsBatchDto> sends,
        IReadOnlyCollection<MessageStatsRecipientDto> recipients)
    {
        var title = l["CSKH:Stats:ExcelTitle"].Value;
        var subtitle = l["CSKH:Stats:ExcelPeriod", from.ToString("dd/MM/yyyy"), to.ToString("dd/MM/yyyy")].Value;
        return ExcelSheet.BuildBook(
        [
            ExcelSheetPart.Of(l["CSKH:Stats:Sheet:Days"], title, DayColumns(), days, subtitle),
            ExcelSheetPart.Of(l["CSKH:Stats:Sheet:Templates"], title, TemplateColumns(), templates, subtitle),
            ExcelSheetPart.Of(l["CSKH:Stats:Sheet:History"], title, SendColumns(), sends, subtitle),
            ExcelSheetPart.Of(l["CSKH:Stats:Sheet:Recipients"], title, RecipientColumns(), recipients, subtitle),
        ]);
    }

    private List<ExcelColumn<MessageStatsDayDto>> DayColumns() =>
    [
        new(l["CSKH:Stats:Col:Date"], d => d.Date, 14),
        new(l["CSKH:Stats:Col:Sent"], d => d.Sent, 12),
        new(l["CSKH:Stats:Col:Succeeded"], d => d.Succeeded, 12),
        new(l["CSKH:Stats:Col:Failed"], d => d.Failed, 12),
    ];

    private List<ExcelColumn<MessageStatsTemplateDto>> TemplateColumns() =>
    [
        new(l["CSKH:Stats:Col:Template"], t => t.Name, 36),
        new(l["CSKH:Stats:Col:Channel"], t => ChannelOf(t.Channel), 10),
        new(l["CSKH:Stats:Col:Uses"], t => t.Uses, 12),
        new(l["CSKH:Stats:Col:Sent"], t => t.Sent, 12),
        new(l["CSKH:Stats:Col:Succeeded"], t => t.Succeeded, 12),
        new(l["CSKH:Stats:Col:SuccessRate"], t => t.Sent == 0 ? null : Math.Round(100m * t.Succeeded / t.Sent, 1), 16),
        new(l["CSKH:Stats:Col:LastSent"], t => t.LastSentAt is { } at ? Local(at) : null, 18),
    ];

    private List<ExcelColumn<MessageStatsBatchDto>> SendColumns() =>
    [
        new(l["CSKH:Stats:Col:At"], b => Local(b.At), 18),
        new(l["CSKH:Stats:Col:Template"], b => b.TemplateName, 32),
        new(l["CSKH:Stats:Col:Channel"], b => ChannelOf(b.Channel), 10),
        new(l["CSKH:Stats:Col:Audience"], AudienceOf, 32),
        new(l["CSKH:Stats:Col:Sender"], b => b.SenderName, 22),
        new(l["CSKH:Stats:Col:Recipients"], b => b.RecipientCount, 12),
        new(l["CSKH:Stats:Col:Succeeded"], b => b.SentCount, 12),
        new(l["CSKH:Stats:Col:Failed"], b => b.FailedCount, 12),
        new(l["CSKH:Stats:Col:Pending"], b => b.PendingCount, 12),
        new(l["CSKH:Stats:Col:Status"], StatusOf, 16),
    ];

    private List<ExcelColumn<MessageStatsRecipientDto>> RecipientColumns() =>
    [
        new(l["CSKH:Stats:Col:Customer"], r => r.Name, 28),
        new(l["CSKH:Stats:Col:Contact"], r => r.Phone, 16),
        new(l["CSKH:Stats:Col:TemplateReceived"], r => r.TemplateName, 32),
        new(l["CSKH:Stats:Col:Channel"], r => ChannelOf(r.Channel), 10),
        new(l["CSKH:Stats:Col:At"], r => Local(r.At), 18),
        new(l["CSKH:Stats:Col:Status"], OutcomeOf, 14),
        new(l["CSKH:Stats:Col:Error"], r => r.Error, 40),
    ];

    private string ChannelOf(MessageChannelType channel) => l[$"CSKH:Channel:{channel}"];

    private string AudienceOf(MessageStatsBatchDto send)
    {
        if (send.Source == MessageRecipientSource.Individual || send.CareType is not { } type)
        {
            return l[$"CSKH:Send:Source:{send.Source}"];
        }

        var span = send.FromDate is { } start && send.ToDate is { } end
            ? $"{Day(start):dd/MM/yyyy} – {Day(end):dd/MM/yyyy}"
            : string.Empty;
        return string.IsNullOrEmpty(span) ? l[$"CSKH:Type:{type}"] : l["CSKH:Stats:Audience:CareList", l[$"CSKH:Type:{type}"], span];
    }

    private string StatusOf(MessageStatsBatchDto send) =>
        send is { Status: MessageSendBatchStatus.Queued, ScheduledAt: not null }
            ? l["CSKH:Stats:Batch:Scheduled"]
            : l[$"CSKH:Stats:Batch:{send.Status}"];

    private string OutcomeOf(MessageStatsRecipientDto recipient) =>
        recipient.Scheduled ? l["CSKH:Stats:Outcome:Scheduled"] : l[$"CSKH:Stats:Outcome:{recipient.Outcome}"];

    private static DateTime Local(DateTime utc) =>
        ClinicCalendar.ToLocal(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc))).DateTime;

    private static DateOnly Day(DateTime utc) =>
        ClinicCalendar.DateOf(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)));
}
