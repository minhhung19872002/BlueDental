using System.ComponentModel.DataAnnotations;
using System.Reflection;
using ClosedXML.Excel;
using BlueDental.CustomerCare;
using BlueDental.CustomerCare.Messaging;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Tools;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>
/// CSKH ▸ Chiến dịch đã gửi (BA P2210, F-79): reading needs cskhSend.read and
/// "Tạm dừng" cskhSend.create; the branch comes through the access checker,
/// the phones follow "Ẩn số điện thoại" on screen and in the file of failures.
/// </summary>
public class MessageCampaignAppServiceContractTests
{
    private readonly Type _serviceType = typeof(MessageCampaignAppService);

    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IMessageCampaignAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void Reading_Needs_The_Send_Read_Permission()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.CskhSend.Read);
    }

    [Fact]
    public void Stopping_Needs_The_Send_Permission()
    {
        _serviceType.GetMethod(nameof(MessageCampaignAppService.StopAsync))!.GetCustomAttribute<AuthorizeAttribute>()!
            .Policy.ShouldBe(BlueDentalAbilityPermissions.CskhSend.Create);
    }

    [Theory]
    [InlineData(nameof(MessageCampaignAppService.GetListAsync))]
    [InlineData(nameof(MessageCampaignAppService.GetAsync))]
    [InlineData(nameof(MessageCampaignAppService.GetRecipientsAsync))]
    [InlineData(nameof(MessageCampaignAppService.ExportFailuresAsync))]
    public void The_Rest_Only_Reads(string method)
    {
        _serviceType.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>().ShouldBeNull();
    }

    [Fact]
    public void Branch_Scope_Goes_Through_The_Access_Checker()
    {
        _serviceType.GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(BranchAccessChecker));
    }

    [Fact]
    public void Phones_Are_Masked_On_Screen_And_In_The_File()
    {
        typeof(MessageCampaignRecipientDto).GetProperty(nameof(MessageCampaignRecipientDto.Phone))!
            .GetCustomAttribute<PatientPhoneAttribute>().ShouldNotBeNull();
        _serviceType.GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(PatientPhoneMasker));
    }

    [Fact]
    public void Paging_Is_Bounded()
    {
        typeof(MessageCampaignPagedInput).GetProperty(nameof(MessageCampaignPagedInput.MaxResultCount))!
            .GetCustomAttribute<RangeAttribute>()!.Maximum.ShouldBe(MessageStatsLimits.MaxPageSize);
    }

    [Fact]
    public void The_File_Of_Failures_Is_Titled_With_The_Template_And_The_Send_Time()
    {
        var l = new StubLocalizer(new Dictionary<string, string>
        {
            ["CSKH:Campaign:ExcelTitle"] = "Kết quả lần gửi · {0}",
            ["CSKH:Campaign:ExcelSent"] = "Gửi lúc {0} · Danh sách lỗi",
            ["CSKH:Campaign:Sheet:Failures"] = "Danh sách lỗi",
            ["CSKH:Campaign:Col:Customer"] = "Khách",
            ["CSKH:Campaign:Outcome:Failed"] = "Thất bại",
            ["CSKH:Campaign:Outcome:Skipped"] = "Bị loại",
        });
        // 03:00 UTC is 10:00 at the clinic (UTC+7).
        var now = new DateTime(2026, 10, 23, 3, 0, 0, DateTimeKind.Utc);
        var branch = Guid.NewGuid();
        var send = MessageSendBatch.Create(Guid.NewGuid(), branch, ReadyZalo(branch),
            new MessageSendRecipients(MessageRecipientSource.Individual, null, null, null, 2, 1),
            skipRecentDuplicates: true, scheduledAt: null, now);
        send.TryStart(now);

        var file = new MessageCampaignExcel(l, send).Build(
        [
            new MessageCampaignRecipientDto
            {
                Name = "Khách thử", Phone = "0900000000", Outcome = MessageCampaignOutcome.Failed,
                Detail = "Số điện thoại không hợp lệ", At = now,
            },
            new MessageCampaignRecipientDto
            {
                Name = "Khách lẻ", Outcome = MessageCampaignOutcome.Skipped, Detail = "Gộp vào tin của Khách thử",
            },
        ]);

        using var book = new XLWorkbook(new MemoryStream(file));
        var sheet = book.Worksheet("Danh sách lỗi");
        sheet.Cell(1, 1).GetString().ShouldBe("Kết quả lần gửi · Nhắc lịch ZNS");
        sheet.Cell(2, 1).GetString().ShouldBe("Gửi lúc 23/10/2026 10:00 · Danh sách lỗi");
        sheet.Cell(4, 1).GetString().ShouldBe("Khách");
        sheet.Cell(5, 2).GetString().ShouldBe("0900000000");
        sheet.Cell(5, 3).GetString().ShouldBe("Thất bại");
        sheet.Cell(5, 4).GetString().ShouldBe("Số điện thoại không hợp lệ");
        sheet.Cell(5, 5).GetDateTime().ShouldBe(new DateTime(2026, 10, 23, 10, 0, 0));
        sheet.Cell(6, 3).GetString().ShouldBe("Bị loại");
        // A customer it never tried has no time.
        sheet.Cell(6, 5).IsEmpty().ShouldBeTrue();
    }

    private static MessageTemplate ReadyZalo(Guid branch) =>
        MessageTemplate.CreatePublished(Guid.NewGuid(), branch, MessageChannelType.Zalo,
            new MessageTemplateContent("Nhắc lịch ZNS", CareType.AppointmentReminder, Content: null, Subject: null,
                "301001", new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}" },
                RemoveDiacritics: false),
            ["customer_name"], "ENABLE");
}
