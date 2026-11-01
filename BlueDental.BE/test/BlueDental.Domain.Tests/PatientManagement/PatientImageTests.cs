using System;
using BlueDental.PatientManagement;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

public class PatientImageTests
{
    private static PatientImage Attach(int ordering = 1, PatientImageType type = PatientImageType.Before) =>
        PatientImage.Attach(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "patients/x/1.png", "1.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow,
            type: type, ordering: ordering);

    private static PatientImage Uploaded(DateTime utc, Guid? stageId)
    {
        var image = PatientImage.Attach(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "patients/x/1.png", "1.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow, treatmentStageId: stageId);
        // Auditing fills CreationTime on save, and its setter is protected.
        ObjectHelper.TrySetProperty(image, x => x.CreationTime, () => utc);
        return image;
    }

    [Theory]
    // 2026-10-31 18:00 UTC is already 01:00 on 1 Nov at the clinic.
    [InlineData("2026-10-31T18:00:00", "2026-11-01", true)]
    [InlineData("2026-11-01T16:59:00", "2026-11-01", true)]
    [InlineData("2026-11-01T02:00:00", "2026-11-02", false)]
    [InlineData("2026-10-31T16:00:00", "2026-11-01", false)]
    public void A_Stage_Picture_Is_Deletable_Only_On_Its_Clinic_Upload_Day(string uploadedUtc, string today, bool deletable)
    {
        // P0111_02 (R-1111): "khi ngày upload = ngày hiện tại; qua ngày rồi thì không cho xóa nữa".
        var image = Uploaded(DateTime.SpecifyKind(DateTime.Parse(uploadedUtc), DateTimeKind.Utc), Guid.NewGuid());

        Assert.Equal(deletable, image.IsDeletableOn(DateOnly.Parse(today)));
    }

    [Fact]
    public void A_Stage_Picture_Past_Its_Upload_Day_Refuses_Deletion()
    {
        var image = Uploaded(new DateTime(2026, 10, 30, 3, 0, 0, DateTimeKind.Utc), Guid.NewGuid());

        var ex = Assert.Throws<BusinessException>(() => image.EnsureDeletableOn(new DateOnly(2026, 11, 1)));
        Assert.Equal(BlueDentalDomainErrorCodes.PatientManagement.StageImageDeleteExpired, ex.Code);
    }

    [Fact]
    public void A_Picture_Outside_A_Stage_Stays_Deletable_Any_Day()
    {
        var image = Uploaded(new DateTime(2026, 1, 2, 3, 0, 0, DateTimeKind.Utc), stageId: null);

        image.EnsureDeletableOn(new DateOnly(2026, 11, 1));
        Assert.True(image.IsDeletableOn(new DateOnly(2026, 11, 1)));
    }

    [Fact]
    public void Attach_Defaults_To_Before_Treatment_At_Position_One()
    {
        var image = PatientImage.Attach(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "patients/x/1.png", "1.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow);

        Assert.Equal(PatientImageType.Before, image.Type);
        Assert.Equal(1, image.Ordering);
    }

    [Fact]
    public void Attach_Keeps_The_Given_Type_And_Position()
    {
        var image = Attach(ordering: 7, type: PatientImageType.After);

        Assert.Equal(PatientImageType.After, image.Type);
        Assert.Equal(7, image.Ordering);
    }

    [Theory]
    [InlineData(true, WarrantyCardSide.Back)]
    [InlineData(false, null)]
    public void A_Warranty_Card_Face_Is_Kept_Only_On_A_Labo_Picture(bool onLaboOrder, WarrantyCardSide? expected)
    {
        var image = PatientImage.Attach(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "patients/x/1.png", "1.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow,
            laboOrderId: onLaboOrder ? Guid.NewGuid() : null,
            laboToothNumber: 11,
            warrantyCardSide: WarrantyCardSide.Back);

        Assert.Equal(expected, image.WarrantyCardSide);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void Attach_Rejects_A_Position_Below_One(int ordering)
    {
        var ex = Assert.Throws<BusinessException>(() => Attach(ordering));

        Assert.Equal(BlueDentalDomainErrorCodes.PatientManagement.InvalidImageOrdering, ex.Code);
    }

    [Fact]
    public void MoveTo_Changes_The_Position()
    {
        var image = Attach(ordering: 2);

        image.MoveTo(5);

        Assert.Equal(5, image.Ordering);
    }

    [Fact]
    public void MoveTo_Rejects_A_Position_Below_One()
    {
        var image = Attach(ordering: 2);

        var ex = Assert.Throws<BusinessException>(() => image.MoveTo(0));

        Assert.Equal(BlueDentalDomainErrorCodes.PatientManagement.InvalidImageOrdering, ex.Code);
        Assert.Equal(2, image.Ordering);
    }

    [Theory]
    [InlineData("image/jpeg", true)]
    [InlineData("image/png", true)]
    [InlineData("image/webp", true)]
    [InlineData("application/dicom", false)]
    [InlineData("application/pdf", false)]
    public void Only_Web_Image_Types_Are_Accepted(string contentType, bool accepted)
    {
        Assert.Equal(accepted, PatientImage.IsSupportedImage(contentType));
    }
}
