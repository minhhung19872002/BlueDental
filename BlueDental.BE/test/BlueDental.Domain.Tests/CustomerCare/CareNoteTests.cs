using System;
using System.Linq;
using BlueDental.CustomerCare;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.CustomerCare;

/// <summary>
/// Care notes (BA P2210) — the chat's "Ghi chú nội bộ" and the record's
/// "Ghi nhận chăm sóc": Tạo records who and when; Sửa logs who and when with
/// the text before; Xoá strikes the note through — it stays — and logs who. A
/// struck note cannot be changed again. A note belongs to a conversation, a
/// record or both, and may carry a "Kết quả cuộc gọi".
/// </summary>
public class CareNoteTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid Conversation = Guid.NewGuid();
    private static readonly Guid Patient = Guid.NewGuid();
    private static readonly Guid Lan = Guid.NewGuid();
    private static readonly Guid Ngoc = Guid.NewGuid();
    private static readonly DateTime Now = new(2026, 10, 23, 3, 0, 0, DateTimeKind.Utc);

    private static CareNote Write(string content = "Khách hay hỏi lúc tối", CareNoteOutcome? outcome = null) =>
        CareNote.Write(Guid.NewGuid(), Branch, Conversation, Patient, content, outcome, Lan, Now);

    [Fact]
    public void Writing_Records_The_Author_The_Time_And_Where_It_Belongs()
    {
        var note = Write("  Ưu tiên trả lời trước 18h  ", CareNoteOutcome.Contacted);

        note.Content.ShouldBe("Ưu tiên trả lời trước 18h");
        note.AuthorId.ShouldBe(Lan);
        note.CreatedAt.ShouldBe(Now);
        note.ConversationId.ShouldBe(Conversation);
        note.PatientId.ShouldBe(Patient);
        note.Outcome.ShouldBe(CareNoteOutcome.Contacted);
        note.Revisions.Single().Action.ShouldBe(CareNoteAction.Created);
    }

    [Fact]
    public void A_Note_Of_The_Record_Alone_Or_Of_The_Chat_Alone_Is_Fine_But_Not_Of_Neither()
    {
        CareNote.Write(Guid.NewGuid(), Branch, null, Patient, "Hồ sơ", null, Lan, Now).ConversationId.ShouldBeNull();
        CareNote.Write(Guid.NewGuid(), Branch, Conversation, Guid.Empty, "Chat", null, Lan, Now).PatientId.ShouldBeNull();

        Should.Throw<ArgumentException>(() => CareNote.Write(Guid.NewGuid(), Branch, null, null, "Lạc", null, Lan, Now));
    }

    [Fact]
    public void Editing_Logs_The_Editor_The_Time_And_The_Text_Before()
    {
        var note = Write("Trước");

        note.Edit("Sau", Ngoc, Now.AddMinutes(5));

        note.Content.ShouldBe("Sau");
        note.LastEditorId.ShouldBe(Ngoc);
        note.LastEditedAt.ShouldBe(Now.AddMinutes(5));
        var edit = note.Revisions.Last();
        edit.Action.ShouldBe(CareNoteAction.Edited);
        edit.Before.ShouldBe("Trước");
        edit.After.ShouldBe("Sau");
        edit.ActorId.ShouldBe(Ngoc);
    }

    [Fact]
    public void The_Same_Text_Again_Leaves_No_History()
    {
        var note = Write("Giống");

        note.Edit(" Giống ", Ngoc, Now.AddMinutes(1));

        note.Revisions.Count.ShouldBe(1);
        note.LastEditorId.ShouldBeNull();
    }

    [Fact]
    public void Deleting_Strikes_It_Through_Keeps_The_Text_And_Logs_Who()
    {
        var note = Write("Còn nhìn thấy");

        note.Remove(Ngoc, Now.AddHours(1));

        note.IsRemoved.ShouldBeTrue();
        note.Content.ShouldBe("Còn nhìn thấy");
        note.RemoverId.ShouldBe(Ngoc);
        note.RemovedAt.ShouldBe(Now.AddHours(1));
        note.Revisions.Last().Action.ShouldBe(CareNoteAction.Removed);
    }

    [Fact]
    public void A_Deleted_Note_Is_Not_Changed_Or_Deleted_Again()
    {
        var note = Write();
        note.Remove(Ngoc, Now);

        Should.Throw<BusinessException>(() => note.Edit("Khác", Lan, Now)).Code
            .ShouldBe(BlueDentalDomainErrorCodes.ZaloInbox.NoteRemoved);
        Should.Throw<BusinessException>(() => note.Remove(Lan, Now)).Code
            .ShouldBe(BlueDentalDomainErrorCodes.ZaloInbox.NoteRemoved);
    }

    [Fact]
    public void A_Note_Needs_Text_Within_The_Limit()
    {
        Should.Throw<BusinessException>(() => Write("   ")).Code
            .ShouldBe(BlueDentalDomainErrorCodes.ZaloInbox.NoteRequired);
        Should.Throw<BusinessException>(() => Write(new string('x', CareNoteConsts.MaxContentLength + 1))).Code
            .ShouldBe(BlueDentalDomainErrorCodes.ZaloInbox.NoteTooLong);
    }
}
