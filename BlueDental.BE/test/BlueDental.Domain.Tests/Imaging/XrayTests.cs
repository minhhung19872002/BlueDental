using System;
using BlueDental.Imaging;
using BlueDental.PatientManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Imaging;

/// <summary>F-95: the paired X-ray PC, the log of what it sent, the file check.</summary>
public class XrayTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 11, 3, 0, 0, TimeSpan.Zero);

    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];

    private static XrayInboxItem Received(XrayDevice device, int? year = 1985) =>
        XrayInboxItem.Receive(Guid.NewGuid(), device, "xray-inbox/b/i.jpg", "DH260001_A.jpg", "image/jpeg",
            6, new string('a', 64), " DH260001 ", "NGUYEN VAN A", year, T0, T0);

    [Fact]
    public void Pair_Gives_A_43_Char_Token_And_Keeps_Only_Its_Hash()
    {
        var (device, token) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "  PC X-quang  ");

        token.Length.ShouldBe(XrayDevice.TokenLength);
        token.ShouldNotContain("+");
        token.ShouldNotContain("/");
        device.TokenHash.ShouldBe(XrayDevice.HashToken(token));
        device.TokenHash.ShouldNotContain(token);
        device.Name.ShouldBe("PC X-quang");
        device.IsActive.ShouldBeTrue();
    }

    [Fact]
    public void Pair_Without_A_Name_Is_Refused()
    {
        Should.Throw<BusinessException>(() => XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "  "))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Imaging.DeviceNameRequired);
    }

    [Fact]
    public void Revoke_Keeps_The_First_Moment()
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");
        device.Revoke(T0);
        device.Revoke(T0.AddHours(1));

        device.RevokedAt.ShouldBe(T0);
        device.IsActive.ShouldBeFalse();
    }

    [Fact]
    public void Touch_Writes_At_Most_Once_A_Minute()
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");

        device.Touch(T0).ShouldBeTrue();
        device.Touch(T0.AddSeconds(30)).ShouldBeFalse();
        device.LastSeenAt.ShouldBe(T0);
        device.Touch(T0.AddMinutes(1)).ShouldBeTrue();
        device.LastSeenAt.ShouldBe(T0.AddMinutes(1));
    }

    [Fact]
    public void Receive_Takes_The_Branch_Of_The_Device_And_Trims_Hints()
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");
        var item = Received(device);

        item.ClinicBranchId.ShouldBe(device.ClinicBranchId);
        item.XrayDeviceId.ShouldBe(device.Id);
        item.HintCode.ShouldBe("DH260001");
        item.HintBirthYear.ShouldBe(1985);
        item.Status.ShouldBe(XrayInboxStatus.Pending);
    }

    [Theory]
    [InlineData(1899)]
    [InlineData(2101)]
    public void Receive_Drops_A_Birth_Year_That_Cannot_Be_One(int year)
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");
        Received(device, year).HintBirthYear.ShouldBeNull();
    }

    [Fact]
    public void Assign_Then_Discard_Is_Refused()
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");
        var item = Received(device);
        var staff = Guid.NewGuid();
        item.Assign(Guid.NewGuid(), Guid.NewGuid(), staff, T0);

        item.Status.ShouldBe(XrayInboxStatus.Assigned);
        item.HandledBy.ShouldBe(staff);
        Should.Throw<BusinessException>(() => item.Discard(staff, T0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Imaging.InboxItemHandled);
    }

    [Fact]
    public void An_Auto_Assigned_Picture_Has_No_Staff_And_Cannot_Be_Assigned_Again()
    {
        var (device, _) = XrayDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "PC");
        var item = Received(device);
        item.MarkAutoAssigned(Guid.NewGuid(), Guid.NewGuid(), T0);

        item.Status.ShouldBe(XrayInboxStatus.AutoAssigned);
        item.HandledBy.ShouldBeNull();
        Should.Throw<BusinessException>(() => item.Assign(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), T0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Imaging.InboxItemHandled);
    }

    [Fact]
    public void Detect_Reads_The_Bytes_Not_The_Name()
    {
        XrayImageFiles.Detect(Jpeg).ShouldBe(("image/jpeg", ".jpg"));
        XrayImageFiles.Detect(Png).ShouldBe(("image/png", ".png"));
        XrayImageFiles.Detect("hello, I am text"u8).ShouldBeNull();
        XrayImageFiles.Detect([0xFF, 0xD8]).ShouldBeNull();
    }

    [Fact]
    public void A_Picture_Put_There_By_The_Xray_Pc_Has_No_Staff()
    {
        var device = Guid.NewGuid();
        var image = PatientImage.Attach(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "patients/p/i.jpg",
            "x.jpg", "image/jpeg", 10, staffId: null, T0, type: PatientImageType.Before, xrayDeviceId: device);

        image.StaffId.ShouldBeNull();
        image.XrayDeviceId.ShouldBe(device);
        image.Type.ShouldBe(PatientImageType.Before);
    }
}
