using System;
using System.Collections.Generic;
using BlueDental.CustomerCare;
using BlueDental.Tools;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Tools;

/// <summary>
/// CSKH ▸ Template tin nhắn (BA P2110, F-76): "Lưu nháp" keeps anything with a
/// name, "Lưu mẫu" needs the template complete for its channel, and a Zalo
/// template takes its status from Zalo's review of the linked ZNS template.
/// </summary>
public class MessageTemplateTests
{
    private static readonly Guid Branch = Guid.NewGuid();

    private static MessageTemplateContent Sms(
        string? name = "Nhắc lịch", string? content = "Chào {ten_khach_hang}", CareType? purpose = CareType.AppointmentReminder) =>
        new(name, purpose, content, Subject: null, ExternalTemplateId: null, ParamMap: null, RemoveDiacritics: true);

    private static MessageTemplateContent Zalo(IReadOnlyDictionary<string, string>? map, string? znsId = "301234") =>
        new("Nhắc lịch ZNS", CareType.AppointmentReminder, Content: null, Subject: null, znsId, map, RemoveDiacritics: false);

    private static void ShouldRefuse(Action act, string code) =>
        Should.Throw<BusinessException>(act).Code.ShouldBe(code);

    [Fact]
    public void A_Draft_Needs_Only_A_Name()
    {
        var draft = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Sms,
            Sms(content: null, purpose: null));

        draft.Status.ShouldBe(MessageTemplateStatus.Draft);
        draft.Content.ShouldBe(string.Empty);
        draft.CanSend.ShouldBeFalse();
    }

    [Fact]
    public void A_Draft_Without_A_Name_Is_Refused()
    {
        ShouldRefuse(
            () => MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(name: "   ")),
            BlueDentalDomainErrorCodes.Tools.TemplateNameRequired);
    }

    [Fact]
    public void A_Published_Sms_Template_Is_Ready_To_Send()
    {
        var template = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms());

        template.Status.ShouldBe(MessageTemplateStatus.Ready);
        template.CanSend.ShouldBeTrue();
        template.RemoveDiacritics.ShouldBeTrue();
        template.GetVariables().ShouldBe(["ten_khach_hang"]);
    }

    [Fact]
    public void Publishing_Needs_A_Purpose_That_Is_A_Care_Tab()
    {
        ShouldRefuse(
            () => MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(purpose: null)),
            BlueDentalDomainErrorCodes.Tools.TemplatePurposeRequired);
        ShouldRefuse(
            () => MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(purpose: CareType.Base)),
            BlueDentalDomainErrorCodes.Tools.TemplatePurposeRequired);
    }

    [Fact]
    public void Publishing_Sms_Needs_Content()
    {
        ShouldRefuse(
            () => MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(content: " ")),
            BlueDentalDomainErrorCodes.Tools.TemplateContentRequired);
    }

    [Fact]
    public void Publishing_Email_Needs_A_Subject()
    {
        var noSubject = new MessageTemplateContent("Sinh nhật", CareType.Birthday, "Chúc mừng {ten_khach_hang}",
            Subject: "", ExternalTemplateId: null, ParamMap: null, RemoveDiacritics: false);

        ShouldRefuse(
            () => MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Email, noSubject),
            BlueDentalDomainErrorCodes.Tools.TemplateSubjectRequired);
    }

    [Fact]
    public void Publishing_Refuses_Variables_Outside_The_Library()
    {
        var exception = Should.Throw<BusinessException>(() => MessageTemplate.CreatePublished(
            Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(content: "Chào {ten_khach_hang} {ma_giam_gia}")));

        exception.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.TemplateUnknownVariables);
        exception.Data["variables"].ShouldBe("{ma_giam_gia}");
    }

    [Fact]
    public void A_Draft_May_Keep_Unknown_Variables_Until_It_Is_Published()
    {
        var draft = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Sms,
            Sms(content: "Chào {ma_giam_gia}"));

        draft.Content.ShouldBe("Chào {ma_giam_gia}");
    }

    [Fact]
    public void Sms_Content_Over_Its_Limit_Is_Refused()
    {
        var exception = Should.Throw<BusinessException>(() => MessageTemplate.CreateDraft(
            Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms(content: new string('a', MessageTemplate.MaxSmsContentLength + 1))));

        exception.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.TemplateTooLong);
        exception.Data["max"].ShouldBe(MessageTemplate.MaxSmsContentLength);
    }

    [Fact]
    public void Each_Channel_Keeps_Only_Its_Own_Fields()
    {
        var mixed = new MessageTemplateContent("Nhắc lịch", CareType.AppointmentReminder, "Chào {ten_khach_hang}",
            "Tiêu đề", "301234", new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}" }, RemoveDiacritics: true);

        var sms = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Sms, mixed);
        sms.Subject.ShouldBeNull();
        sms.ExternalTemplateId.ShouldBeNull();
        sms.GetParamMap().ShouldBeEmpty();

        var email = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Email, mixed);
        email.Subject.ShouldBe("Tiêu đề");
        email.RemoveDiacritics.ShouldBeFalse();
        email.ExternalTemplateId.ShouldBeNull();
    }

    [Fact]
    public void A_Zalo_Template_Needs_A_Zns_Template()
    {
        ShouldRefuse(
            () => MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Zalo, Zalo(null, znsId: null)),
            BlueDentalDomainErrorCodes.Tools.TemplateZnsRequired);
    }

    [Fact]
    public void A_Zalo_Template_Must_Fill_Every_Required_Zns_Param()
    {
        var map = new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}", ["booking_date"] = "  " };

        var exception = Should.Throw<BusinessException>(() => MessageTemplate.CreatePublished(
            Guid.NewGuid(), Branch, MessageChannelType.Zalo, Zalo(map), ["customer_name", "booking_date"], "ENABLE"));

        exception.Code.ShouldBe(BlueDentalDomainErrorCodes.Tools.TemplateZnsParamUnmapped);
        exception.Data["params"].ShouldBe("booking_date");
    }

    [Theory]
    [InlineData("ENABLE", MessageTemplateStatus.Ready)]
    [InlineData("PENDING_REVIEW", MessageTemplateStatus.PendingApproval)]
    [InlineData("REJECT", MessageTemplateStatus.Rejected)]
    [InlineData("DISABLE", MessageTemplateStatus.Disabled)]
    [InlineData("DELETE", MessageTemplateStatus.Disabled)]
    [InlineData(null, MessageTemplateStatus.PendingApproval)]
    public void A_Published_Zalo_Template_Takes_Zalos_Status(string? zaloStatus, MessageTemplateStatus expected)
    {
        var map = new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}" };

        var template = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Zalo,
            Zalo(map), ["customer_name"], zaloStatus);

        template.Status.ShouldBe(expected);
        template.Content.ShouldBe("customer_name: {ten_khach_hang}");
        template.GetVariables().ShouldBe(["ten_khach_hang"]);
    }

    [Fact]
    public void Syncing_Zalos_Status_Leaves_Drafts_And_Other_Channels_Alone()
    {
        var draft = MessageTemplate.CreateDraft(Guid.NewGuid(), Branch, MessageChannelType.Zalo, Zalo(null));
        draft.SyncZaloStatus("ENABLE");
        draft.Status.ShouldBe(MessageTemplateStatus.Draft);

        var sms = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms());
        sms.SyncZaloStatus("REJECT");
        sms.Status.ShouldBe(MessageTemplateStatus.Ready);

        var map = new Dictionary<string, string> { ["customer_name"] = "{ten_khach_hang}" };
        var zalo = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Zalo, Zalo(map), [], "PENDING_REVIEW");
        zalo.SyncZaloStatus("ENABLE");
        zalo.Status.ShouldBe(MessageTemplateStatus.Ready);
    }

    [Fact]
    public void Duplicating_Gives_A_Draft_Copy_In_The_Same_Branch_And_Channel()
    {
        var original = MessageTemplate.CreatePublished(Guid.NewGuid(), Branch, MessageChannelType.Sms, Sms());

        var copy = original.Duplicate(Guid.NewGuid(), " Nhắc lịch - bản sao ");

        copy.Name.ShouldBe("Nhắc lịch - bản sao");
        copy.Status.ShouldBe(MessageTemplateStatus.Draft);
        copy.ClinicBranchId.ShouldBe(Branch);
        copy.Channel.ShouldBe(MessageChannelType.Sms);
        copy.Content.ShouldBe(original.Content);
        copy.Purpose.ShouldBe(original.Purpose);
    }

    [Fact]
    public void The_Tools_Screens_Template_Stays_Usable_Without_A_Purpose()
    {
        var legacy = new MessageTemplate(Guid.NewGuid(), Branch, "Cũ", "Nội dung", MessageChannelType.Sms, null);

        legacy.Purpose.ShouldBeNull();
        legacy.CanSend.ShouldBeTrue();
    }
}
