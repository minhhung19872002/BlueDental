using System;
using BlueDental.ZaloInbox;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.ZaloInbox;

/// <summary>
/// CSKH ▸ Hộp thư Zalo (BA P2210, F-79): "Nhận xử lý" holds a conversation for
/// one staff member for 15 minutes from taking it or their last answer, only
/// the holder answers, hands it on or lets it go; Chưa trả lời until the OA
/// answers after the customer's last message; free-text tags.
/// </summary>
public class ZaloConversationTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid Lan = Guid.NewGuid();
    private static readonly Guid Ngoc = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 10, 23, 3, 0, 0, DateTimeKind.Utc);

    private static ZaloConversation Open() =>
        ZaloConversation.Open(Guid.NewGuid(), Branch, "4521000000001234", "Trần Thái An", null, null);

    private static void ShouldRefuse(Action act, string code) =>
        Should.Throw<BusinessException>(act).Code.ShouldBe(code);

    [Fact]
    public void A_Customer_Message_Waits_As_Unreplied()
    {
        var conversation = Open();

        conversation.RecordMessage(ZaloChatDirection.Inbound, Now, "Có cần qua phòng khám sớm không bác sĩ?");

        conversation.Status.ShouldBe(ZaloConversationStatus.Unreplied);
        conversation.LastMessagePreview.ShouldBe("Có cần qua phòng khám sớm không bác sĩ?");
        conversation.LastCustomerMessageAt.ShouldBe(Now);
    }

    [Fact]
    public void An_Answer_Cares_And_A_New_Customer_Message_Brings_It_Back()
    {
        var conversation = Open();
        conversation.RecordMessage(ZaloChatDirection.Inbound, Now, "Hỏi giá");

        conversation.RecordMessage(ZaloChatDirection.Outbound, Now.AddMinutes(2), "Dạ");
        conversation.Status.ShouldBe(ZaloConversationStatus.Cared);

        conversation.RecordMessage(ZaloChatDirection.Inbound, Now.AddMinutes(5), "Còn nữa ạ");
        conversation.Status.ShouldBe(ZaloConversationStatus.Unreplied);
    }

    [Fact]
    public void An_Older_Message_From_A_Sync_Changes_Neither_Status_Nor_Preview()
    {
        var conversation = Open();
        conversation.RecordMessage(ZaloChatDirection.Inbound, Now, "Mới nhất");

        conversation.RecordMessage(ZaloChatDirection.Outbound, Now.AddDays(-1), "Hôm qua");

        conversation.Status.ShouldBe(ZaloConversationStatus.Unreplied);
        conversation.LastMessagePreview.ShouldBe("Mới nhất");
        conversation.LastMessageAt.ShouldBe(Now);
    }

    [Fact]
    public void A_Conversation_The_Oa_Opened_Has_Nothing_To_Answer()
    {
        var conversation = Open();

        conversation.RecordMessage(ZaloChatDirection.Outbound, Now, "[ZNS] Nhắc lịch");

        conversation.Status.ShouldBe(ZaloConversationStatus.Cared);
    }

    [Fact]
    public void Claiming_Holds_It_For_Fifteen_Minutes()
    {
        var conversation = Open();

        conversation.Claim(Lan, Now);

        conversation.IsHeldBy(Lan, Now.AddMinutes(14)).ShouldBeTrue();
        conversation.HolderAt(Now.AddMinutes(15)).ShouldBeNull();
    }

    [Fact]
    public void Someone_Elses_Live_Hold_Refuses_But_A_Lapsed_One_Does_Not()
    {
        var conversation = Open();
        conversation.Claim(Lan, Now);

        ShouldRefuse(() => conversation.Claim(Ngoc, Now.AddMinutes(10)),
            BlueDentalDomainErrorCodes.ZaloInbox.HeldByOther);

        conversation.Claim(Ngoc, Now.AddMinutes(16));
        conversation.IsHeldBy(Ngoc, Now.AddMinutes(16)).ShouldBeTrue();
    }

    [Fact]
    public void Only_The_Holder_Answers_And_Each_Answer_Renews_The_Hold()
    {
        var conversation = Open();
        conversation.RecordMessage(ZaloChatDirection.Inbound, Now, "Hỏi");

        ShouldRefuse(() => conversation.RecordReply(Lan, Now, "Dạ", Now), BlueDentalDomainErrorCodes.ZaloInbox.NotHolder);

        conversation.Claim(Lan, Now);
        conversation.RecordReply(Lan, Now.AddMinutes(10), "Dạ", Now.AddMinutes(10));

        conversation.Status.ShouldBe(ZaloConversationStatus.Cared);
        conversation.IsHeldBy(Lan, Now.AddMinutes(20)).ShouldBeTrue();
        conversation.HolderAt(Now.AddMinutes(25)).ShouldBeNull();
    }

    [Fact]
    public void Letting_Go_Frees_It_And_Only_The_Holder_May()
    {
        var conversation = Open();
        conversation.Claim(Lan, Now);

        ShouldRefuse(() => conversation.Release(Ngoc, Now), BlueDentalDomainErrorCodes.ZaloInbox.NotHolder);

        conversation.Release(Lan, Now);
        conversation.HolderAt(Now).ShouldBeNull();
        conversation.HolderId.ShouldBeNull();
    }

    [Fact]
    public void Handing_On_Gives_The_Colleague_A_Fresh_Hold()
    {
        var conversation = Open();
        conversation.Claim(Lan, Now);

        conversation.TransferTo(Lan, Ngoc, Now.AddMinutes(10));

        conversation.IsHeldBy(Ngoc, Now.AddMinutes(24)).ShouldBeTrue();
        conversation.IsHeldBy(Lan, Now.AddMinutes(11)).ShouldBeFalse();
    }

    [Fact]
    public void Handing_On_Needs_The_Hold_And_Someone_Else()
    {
        var conversation = Open();

        ShouldRefuse(() => conversation.TransferTo(Lan, Ngoc, Now), BlueDentalDomainErrorCodes.ZaloInbox.NotHolder);

        conversation.Claim(Lan, Now);
        ShouldRefuse(() => conversation.TransferTo(Lan, Lan, Now), BlueDentalDomainErrorCodes.ZaloInbox.TransferToSelf);
    }

    [Fact]
    public void A_Tin_Tu_Van_Goes_Only_Within_48_Hours_Of_The_Customers_Last_Message()
    {
        var conversation = Open();
        conversation.CanReplyFreely(Now).ShouldBeFalse();

        conversation.RecordMessage(ZaloChatDirection.Inbound, Now, "Hỏi");

        conversation.ReplyWindowEndsAt.ShouldBe(Now.AddHours(48));
        conversation.CanReplyFreely(Now.AddHours(47)).ShouldBeTrue();
        ShouldRefuse(() => conversation.EnsureCanReplyFreely(Now.AddHours(48)),
            BlueDentalDomainErrorCodes.ZaloInbox.ReplyWindowClosed);
    }

    [Fact]
    public void Tags_Are_Free_Text_Tidied_And_Kept_Once()
    {
        var conversation = Open();

        conversation.SetTags(["  Niềng   răng ", "VIP", "vip", "", null]);

        conversation.Tags.ShouldBe(["Niềng răng", "VIP"]);
    }

    [Fact]
    public void Tags_Have_A_Length_And_A_Count_Limit()
    {
        var conversation = Open();

        ShouldRefuse(() => conversation.SetTags([new string('a', ZaloInboxConsts.MaxTagLength + 1)]),
            BlueDentalDomainErrorCodes.ZaloInbox.TagTooLong);
        ShouldRefuse(() => conversation.SetTags([.. System.Linq.Enumerable.Range(1, ZaloInboxConsts.MaxTags + 1).Select(i => $"tag {i}")]),
            BlueDentalDomainErrorCodes.ZaloInbox.TooManyTags);
    }

    [Fact]
    public void A_Blank_Name_Falls_Back_To_The_End_Of_The_Zalo_Id()
    {
        var conversation = ZaloConversation.Open(Guid.NewGuid(), Branch, "4521000000009876", "  ", null, null);

        conversation.DisplayName.ShouldBe("Zalo …9876");
    }
}
