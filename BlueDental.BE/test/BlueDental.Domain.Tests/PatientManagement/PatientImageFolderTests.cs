using System;
using BlueDental.PatientManagement;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

/// <summary>Thư mục of the Hình ảnh tab (F-98).</summary>
public class PatientImageFolderTests
{
    private static readonly Guid PatientId = Guid.NewGuid();
    private static readonly Guid BranchId = Guid.NewGuid();

    private static PatientImageFolder Folder(string? name = "Răng hàm trên", PatientImageType type = PatientImageType.Before) =>
        PatientImageFolder.Create(Guid.NewGuid(), PatientId, BranchId, type, name);

    private static PatientImage Picture(
        Guid? patientId = null, Guid? branchId = null, PatientImageType type = PatientImageType.Before) =>
        PatientImage.Attach(
            Guid.NewGuid(), patientId ?? PatientId, branchId ?? BranchId,
            "patients/x/1.png", "1.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow, type: type, ordering: 1);

    [Fact]
    public void A_Name_Is_Trimmed_And_Inner_Spaces_Fold_To_One()
    {
        Assert.Equal("Răng hàm trên", Folder("   Răng   hàm\ttrên  ").Name);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("    ")]
    public void A_Folder_Needs_A_Name(string? name)
    {
        Assert.ThrowsAny<ArgumentException>(() => Folder(name));
    }

    [Fact]
    public void A_Name_Longer_Than_The_Column_Is_Refused()
    {
        Folder(new string('a', PatientImageFolder.MaxNameLength));
        Assert.ThrowsAny<ArgumentException>(() => Folder(new string('a', PatientImageFolder.MaxNameLength + 1)));
    }

    [Fact]
    public void Rename_Applies_The_Same_Rules()
    {
        var folder = Folder();
        folder.Rename("  X quang  ");
        Assert.Equal("X quang", folder.Name);
        Assert.ThrowsAny<ArgumentException>(() => folder.Rename(" "));
    }

    [Fact]
    public void Names_Differing_Only_In_Case_Or_Spacing_Share_A_Key()
    {
        Assert.Equal(PatientImageFolder.NameKey("Răng  Hàm"), PatientImageFolder.NameKey(" răng hàm "));
        Assert.NotEqual(PatientImageFolder.NameKey("Răng hàm"), PatientImageFolder.NameKey("Rang ham"));
    }

    [Fact]
    public void A_Picture_Files_Into_A_Folder_Of_Its_Column_And_Back_Out()
    {
        var folder = Folder();
        var picture = Picture();

        picture.FileInto(folder);
        Assert.Equal(folder.Id, picture.FolderId);

        picture.FileInto(null);
        Assert.Null(picture.FolderId);
    }

    [Fact]
    public void A_Picture_Of_Another_Column_Is_Refused()
    {
        var ex = Assert.Throws<BusinessException>(() =>
            Picture(type: PatientImageType.After).FileInto(Folder(type: PatientImageType.Before)));
        Assert.Equal(BlueDentalDomainErrorCodes.PatientManagement.ImageFolderMismatch, ex.Code);
    }

    [Fact]
    public void A_Picture_Of_Another_Patient_Or_Branch_Is_Refused()
    {
        var folder = Folder();

        Assert.Throws<BusinessException>(() => Picture(patientId: Guid.NewGuid()).FileInto(folder));
        Assert.Throws<BusinessException>(() => Picture(branchId: Guid.NewGuid()).FileInto(folder));
    }
}
