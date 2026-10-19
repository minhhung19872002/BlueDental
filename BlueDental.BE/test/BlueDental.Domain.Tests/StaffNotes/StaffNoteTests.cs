using System;
using BlueDental.StaffNotes;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.StaffNotes;

/// <summary>Ghi chú in the header (F-74): content guards, scope and authorship.</summary>
public class StaffNoteTests
{
    private static readonly Guid Author = Guid.NewGuid();

    private static string CodeOf(Action act) => Assert.Throws<BusinessException>(act).Code!;

    /// <summary>ABP stamps the author on insert; a test stamps it by hand.</summary>
    private static StaffNote WrittenBy(StaffNote note, Guid userId)
    {
        ObjectHelper.TrySetProperty(note, x => x.CreatorId, () => userId);
        return note;
    }

    [Fact]
    public void A_Shared_Note_Belongs_To_Its_Branch()
    {
        var branchId = Guid.NewGuid();
        var note = StaffNote.CreateShared(Guid.NewGuid(), branchId, "Gọi lab trước 10h");

        Assert.Equal(StaffNoteScope.Shared, note.Scope);
        Assert.Equal(branchId, note.ClinicBranchId);
    }

    [Fact]
    public void A_Personal_Note_Has_No_Branch()
    {
        var note = StaffNote.CreatePersonal(Guid.NewGuid(), "Nhắc việc");

        Assert.Equal(StaffNoteScope.Personal, note.Scope);
        Assert.Null(note.ClinicBranchId);
    }

    [Fact]
    public void A_Shared_Note_Needs_A_Branch()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.BranchRequired,
            CodeOf(() => StaffNote.CreateShared(Guid.NewGuid(), Guid.Empty, "x")));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t")]
    [InlineData(null)]
    public void Blank_Content_Is_Refused(string? content)
    {
        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.ContentRequired,
            CodeOf(() => StaffNote.CreatePersonal(Guid.NewGuid(), content!)));
    }

    [Fact]
    public void Content_Is_Trimmed_And_Capped()
    {
        Assert.Equal("a\nb", StaffNote.CreatePersonal(Guid.NewGuid(), "  a\nb \n").Content);
        Assert.Equal(StaffNote.MaxContentLength,
            StaffNote.CreatePersonal(Guid.NewGuid(), new string('x', StaffNote.MaxContentLength)).Content.Length);
        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.ContentTooLong,
            CodeOf(() => StaffNote.CreatePersonal(Guid.NewGuid(), new string('x', StaffNote.MaxContentLength + 1))));
    }

    [Fact]
    public void Only_The_Author_Edits()
    {
        var note = WrittenBy(StaffNote.CreatePersonal(Guid.NewGuid(), "cũ"), Author);

        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.NotOwner, CodeOf(() => note.Edit(Guid.NewGuid(), "mới")));
        Assert.Equal("cũ", note.Content);

        note.Edit(Author, " mới ");
        Assert.Equal("mới", note.Content);
    }

    [Fact]
    public void Editing_Keeps_The_Content_Rules()
    {
        var note = WrittenBy(StaffNote.CreatePersonal(Guid.NewGuid(), "cũ"), Author);

        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.ContentRequired, CodeOf(() => note.Edit(Author, " ")));
        Assert.Equal("cũ", note.Content);
    }

    [Fact]
    public void Only_The_Author_Owns_It()
    {
        var note = WrittenBy(StaffNote.CreateShared(Guid.NewGuid(), Guid.NewGuid(), "x"), Author);

        Assert.True(note.IsOwnedBy(Author));
        Assert.False(note.IsOwnedBy(Guid.NewGuid()));
        Assert.Equal(BlueDentalDomainErrorCodes.StaffNotes.NotOwner, CodeOf(() => note.EnsureOwnedBy(Guid.NewGuid())));
    }
}
