using System;
using System.Linq;
using BlueDental.PatientManagement;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.PatientManagement;

public class MedicalRecordDrawingTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];

    [Fact]
    public void A_Png_Is_Accepted()
    {
        MedicalRecordDrawing.EnsureValid(Png);
    }

    [Fact]
    public void Anything_That_Is_Not_A_Png_Is_Refused_Whatever_It_Claims_To_Be()
    {
        var svg = "<svg onload=alert(1)>"u8.ToArray();

        var error = Assert.Throws<BusinessException>(() => MedicalRecordDrawing.EnsureValid(svg));
        Assert.Equal(BlueDentalDomainErrorCodes.PatientManagement.InvalidMedicalRecordDrawing, error.Code);
    }

    [Fact]
    public void An_Empty_Upload_Is_Refused()
    {
        Assert.Throws<BusinessException>(() => MedicalRecordDrawing.EnsureValid([]));
    }

    [Fact]
    public void A_Png_Over_The_Limit_Is_Refused()
    {
        var huge = new byte[MedicalRecordDrawing.MaxSizeInBytes + 1];
        Png.CopyTo(huge, 0);

        Assert.Throws<BusinessException>(() => MedicalRecordDrawing.EnsureValid(huge));
    }

    [Fact]
    public void The_Sheet_Content_Is_Read_For_Its_Own_Drawings_Only()
    {
        var record = Guid.NewGuid();
        var mine = Guid.NewGuid();
        var someoneElses = Guid.NewGuid();
        var content =
            "{\"fieldValues\":{" +
            $"\"procedure-record.diagram\":\"/api/v1/app/patient-medical-records/{record}/drawings/{mine}\"," +
            $"\"x\":\"/api/v1/app/patient-medical-records/{Guid.NewGuid()}/drawings/{someoneElses}\"" +
            "}}";

        var ids = MedicalRecordDrawing.IdsIn(record, content);

        Assert.Equal([mine], ids.ToArray());
    }

    [Fact]
    public void A_Sheet_With_No_Content_Links_No_Drawings()
    {
        Assert.Empty(MedicalRecordDrawing.IdsIn(Guid.NewGuid(), null));
    }

    [Fact]
    public void A_Drawing_Is_Stored_Under_Its_Sheet()
    {
        var record = Guid.NewGuid();
        var drawing = Guid.NewGuid();

        Assert.Equal(
            $"patient-medical-records/{record:N}/drawings/{drawing:N}.png",
            MedicalRecordDrawing.BlobNameOf(record, drawing));
    }
}
