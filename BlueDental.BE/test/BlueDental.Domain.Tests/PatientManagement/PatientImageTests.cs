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
