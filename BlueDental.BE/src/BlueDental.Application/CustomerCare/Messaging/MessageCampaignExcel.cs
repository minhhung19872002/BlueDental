using System;
using System.Collections.Generic;
using BlueDental.Exporting;
using BlueDental.Tools;
using Microsoft.Extensions.Localization;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// "Xuất Excel danh sách lỗi" of Kết quả lần gửi (F-79): the customers a send
/// failed and those it left out, with why, in the viewer's language and on the clinic's clock.
/// </summary>
internal sealed class MessageCampaignExcel(IStringLocalizer l, MessageSendBatch send)
{
    public byte[] Build(IReadOnlyCollection<MessageCampaignRecipientDto> rows)
    {
        var title = l["CSKH:Campaign:ExcelTitle", send.TemplateName].Value;
        var subtitle = l["CSKH:Campaign:ExcelSent", Local(send.StartedAt ?? send.ScheduledAt ?? send.CreationTime)
            .ToString("dd/MM/yyyy HH:mm")].Value;
        return ExcelSheet.BuildBook([ExcelSheetPart.Of(l["CSKH:Campaign:Sheet:Failures"], title, Columns(), rows, subtitle)]);
    }

    private List<ExcelColumn<MessageCampaignRecipientDto>> Columns() =>
    [
        new(l["CSKH:Campaign:Col:Customer"], r => r.Name, 28),
        new(l["CSKH:Campaign:Col:Phone"], r => r.Phone, 16),
        new(l["CSKH:Campaign:Col:Outcome"], r => l[$"CSKH:Campaign:Outcome:{r.Outcome}"].Value, 14),
        new(l["CSKH:Campaign:Col:Detail"], r => r.Detail, 48),
        new(l["CSKH:Campaign:Col:At"], r => r.At is { } at ? Local(at) : null, 18),
    ];

    private static DateTime Local(DateTime utc) =>
        ClinicCalendar.ToLocal(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc))).DateTime;
}
