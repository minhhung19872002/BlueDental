using System.Globalization;
using ClosedXML.Excel;
using BlueDental.CustomerCare;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Tools;
using Microsoft.Extensions.Localization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>
/// What Thống kê CSKH (F-78) says about a message: the sender's stored
/// failure reasons in the viewer's language, and the Excel's four sheets.
/// </summary>
public class MessageStatsWordingTests
{
    private static readonly StubLocalizer L = new(new Dictionary<string, string>
    {
        ["CSKH:Stats:Error:NoCustomer"] = "Không tìm thấy khách hàng",
        ["CSKH:Stats:Error:SendError"] = "Lỗi khi gửi",
        ["CSKH:Stats:Error:MissingData"] = "Thiếu dữ liệu: {0}",
        ["CSKH:Stats:Error:TemplateUnreadable"] = "Không đọc được mẫu Zalo: {0}",
        ["CSKH:Stats:ExcelTitle"] = "Thống kê CSKH",
        ["CSKH:Stats:ExcelPeriod"] = "Từ {0} đến {1}",
        ["CSKH:Stats:Sheet:Days"] = "Theo ngày",
        ["CSKH:Stats:Sheet:Templates"] = "Theo mẫu",
        ["CSKH:Stats:Sheet:History"] = "Lịch sử gửi",
        ["CSKH:Stats:Sheet:Recipients"] = "Người nhận",
        ["CSKH:Stats:Col:Date"] = "Ngày",
        ["CSKH:Stats:Col:Status"] = "Trạng thái",
        ["CSKH:Stats:Batch:Scheduled"] = "Đã hẹn giờ",
        ["CSKH:Stats:Batch:Completed"] = "Hoàn tất",
        ["CSKH:Stats:Outcome:Failed"] = "Thất bại",
        ["CSKH:Stats:Outcome:Scheduled"] = "Đã hẹn giờ",
        ["CSKH:Stats:Audience:CareList"] = "{0} · {1}",
        ["CSKH:Type:Birthday"] = "Chúc mừng sinh nhật",
        ["CSKH:Send:Source:Individual"] = "Khách lẻ",
        ["CSKH:Channel:Zalo"] = "Zalo",
    });

    [Fact]
    public void Fixed_Reasons_Are_Said_In_The_Viewers_Language()
    {
        MessageFailureReasons.Describe(MessageFailureReasons.CustomerNotFound, L).ShouldBe("Không tìm thấy khách hàng");
        MessageFailureReasons.Describe(MessageFailureReasons.SendError, L).ShouldBe("Lỗi khi gửi");
    }

    [Fact]
    public void Reasons_With_Details_Keep_The_Details()
    {
        MessageFailureReasons.Describe(MessageFailureReasons.MissingData(["Ngày hẹn", "Bác sĩ"]), L)
            .ShouldBe("Thiếu dữ liệu: Ngày hẹn, Bác sĩ");
        MessageFailureReasons.Describe(MessageFailureReasons.TemplateUnreadable("-124"), L)
            .ShouldBe("Không đọc được mẫu Zalo: -124");
    }

    [Fact]
    public void A_Providers_Own_Words_Are_Shown_As_They_Came()
    {
        MessageFailureReasons.Describe("User has blocked the OA", L).ShouldBe("User has blocked the OA");
        MessageFailureReasons.Describe(null, L).ShouldBeNull();
        MessageFailureReasons.Describe("  ", L).ShouldBeNull();
    }

    [Fact]
    public void The_Excel_Has_One_Titled_Sheet_Per_Table()
    {
        var day = new DateOnly(2026, 10, 5);
        // 03:30 UTC is 10:30 at the clinic (UTC+7).
        var at = new DateTime(2026, 10, 5, 3, 30, 0, DateTimeKind.Utc);
        var file = new MessageStatsExcel(L, new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31)).Build(
            [new MessageStatsDayDto { Date = day, Sent = 3, Succeeded = 2, Failed = 1 }],
            [new MessageStatsTemplateDto { Name = "Sinh nhật", Channel = MessageChannelType.Zalo, Uses = 1, Sent = 3, Succeeded = 2, LastSentAt = at }],
            [
                new MessageStatsBatchDto
                {
                    At = at, Channel = MessageChannelType.Zalo, TemplateName = "Sinh nhật",
                    Source = MessageRecipientSource.CareList, CareType = CareType.Birthday,
                    FromDate = at, ToDate = at, Status = MessageSendBatchStatus.Queued, ScheduledAt = at,
                },
            ],
            [
                new MessageStatsRecipientDto
                {
                    Name = "Khách thử", Phone = "0900000000", Channel = MessageChannelType.Zalo, At = at,
                    Outcome = MessageStatsOutcome.Failed, Error = "Lỗi khi gửi",
                },
            ]);

        using var book = new XLWorkbook(new MemoryStream(file));
        book.Worksheets.Select(w => w.Name).ShouldBe(["Theo ngày", "Theo mẫu", "Lịch sử gửi", "Người nhận"]);

        var days = book.Worksheet("Theo ngày");
        days.Cell(1, 1).GetString().ShouldBe("Thống kê CSKH");
        days.Cell(2, 1).GetString().ShouldBe("Từ 01/10/2026 đến 31/10/2026");
        // A blank row parts the title from the header.
        days.Cell(4, 1).GetString().ShouldBe("Ngày");
        days.Cell(5, 1).GetDateTime().ShouldBe(new DateTime(2026, 10, 5));
        days.Cell(5, 2).GetDouble().ShouldBe(3);

        var history = book.Worksheet("Lịch sử gửi");
        history.Cell(5, 1).GetDateTime().ShouldBe(new DateTime(2026, 10, 5, 10, 30, 0));
        history.Cell(5, 4).GetString().ShouldBe("Chúc mừng sinh nhật · 05/10/2026 – 05/10/2026");
        history.Cell(5, 10).GetString().ShouldBe("Đã hẹn giờ");

        var recipients = book.Worksheet("Người nhận");
        recipients.Cell(5, 2).GetString().ShouldBe("0900000000");
        recipients.Cell(5, 6).GetString().ShouldBe("Thất bại");
        recipients.Cell(5, 7).GetString().ShouldBe("Lỗi khi gửi");
    }

    private sealed class StubLocalizer(Dictionary<string, string> texts) : IStringLocalizer
    {
        public LocalizedString this[string name] =>
            new(name, texts.GetValueOrDefault(name, name), !texts.ContainsKey(name));

        public LocalizedString this[string name, params object[] arguments] =>
            new(name, string.Format(CultureInfo.InvariantCulture, this[name].Value, arguments), !texts.ContainsKey(name));

        public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) =>
            texts.Select(t => new LocalizedString(t.Key, t.Value));
    }
}
