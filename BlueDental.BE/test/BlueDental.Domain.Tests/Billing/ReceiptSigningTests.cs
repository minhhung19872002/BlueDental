using System;
using System.Security.Cryptography;
using BlueDental.Billing;
using Microsoft.Extensions.Options;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Billing;

/// <summary>P2610 phase 4: the iPad session, the paired device, the stored signature.</summary>
public class ReceiptSigningTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 27, 3, 0, 0, TimeSpan.Zero);

    private static ReceiptSigningSession Sent() =>
        ReceiptSigningSession.Open(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "THANHTOAN-0001", T0);

    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3];

    [Fact]
    public void Signing_Before_The_Check_Is_Refused()
    {
        var session = Sent();

        Should.Throw<BusinessException>(() => session.Sign("v1:x", Guid.NewGuid(), T0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.SigningNotChecked);
    }

    [Fact]
    public void Sign_Records_The_Moment_Of_Hoan_Tat_Ky()
    {
        var session = Sent();
        session.MarkChecked(T0.AddMinutes(1));
        session.Sign("v1:x", Guid.NewGuid(), T0.AddMinutes(2));

        session.CheckedAt.ShouldBe(T0.AddMinutes(1));
        session.SignedAt.ShouldBe(T0.AddMinutes(2));
        session.IsSigned.ShouldBeTrue();
    }

    [Fact]
    public void Resign_Drops_The_Signature_But_Keeps_The_Check()
    {
        var session = Sent();
        session.MarkChecked(T0);
        session.Sign("v1:x", Guid.NewGuid(), T0);

        session.RequestResign();

        session.SignatureCipher.ShouldBeNull();
        session.SignedAt.ShouldBeNull();
        session.CheckedAt.ShouldBe(T0);
    }

    [Fact]
    public void Resend_Starts_The_Customer_Over()
    {
        var session = Sent();
        session.MarkChecked(T0);
        session.Sign("v1:x", Guid.NewGuid(), T0);

        session.Resend(T0.AddMinutes(5));

        session.SentAt.ShouldBe(T0.AddMinutes(5));
        session.CheckedAt.ShouldBeNull();
        session.SignedAt.ShouldBeNull();
    }

    [Fact]
    public void A_Closed_Session_Takes_Nothing_And_Keeps_Its_First_Reason()
    {
        var session = Sent();
        session.Close(SigningCloseReason.Issued, T0);
        session.Close(SigningCloseReason.Cancelled, T0.AddMinutes(1));

        session.CloseReason.ShouldBe(SigningCloseReason.Issued);
        Should.Throw<BusinessException>(() => session.MarkChecked(T0))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.SigningSessionClosed);
    }

    [Fact]
    public void Issued_Screen_Shows_For_A_While_Only()
    {
        var session = Sent();
        session.Close(SigningCloseReason.Issued, T0);

        session.ShowsIssued(T0.AddSeconds(10)).ShouldBeTrue();
        session.ShowsIssued(T0 + ReceiptSigningSession.IssuedShownFor).ShouldBeFalse();
    }

    [Fact]
    public void Pairing_Hands_Out_A_Token_And_Stores_Only_Its_Hash()
    {
        var (device, token) = SigningDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), "  iPad quầy 1 ");

        token.Length.ShouldBe(SigningDevice.TokenLength);
        device.Name.ShouldBe("iPad quầy 1");
        device.TokenHash.ShouldBe(SigningDevice.HashToken(token));
        device.TokenHash.ShouldNotContain(token);
        device.IsActive.ShouldBeTrue();
    }

    [Fact]
    public void Pairing_Without_A_Name_Is_Refused()
    {
        Should.Throw<BusinessException>(() => SigningDevice.Pair(Guid.NewGuid(), Guid.NewGuid(), " "))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.SigningDeviceNameRequired);
    }

    [Fact]
    public void Cipher_Round_Trips_And_Never_Stores_The_Plain_Bytes()
    {
        var cipher = Cipher(RandomNumberGenerator.GetBytes(32));

        var stored = cipher.Encrypt(Png);

        stored.ShouldStartWith("v1:");
        stored.ShouldNotContain(Convert.ToBase64String(Png));
        cipher.Decrypt(stored).ShouldBe(Png);
    }

    [Fact]
    public void Cipher_With_Another_Key_Cannot_Read_It()
    {
        var stored = Cipher(RandomNumberGenerator.GetBytes(32)).Encrypt(Png);

        Should.Throw<CryptographicException>(() => Cipher(RandomNumberGenerator.GetBytes(32)).Decrypt(stored));
    }

    [Fact]
    public void Cipher_Without_A_Key_Refuses_To_Store()
    {
        var cipher = new AesGcmReceiptCipher(Options.Create(new ReceiptVaultOptions()));

        Should.Throw<BusinessException>(() => cipher.Encrypt(Png))
            .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.ReceiptVaultKeyMissing);
    }

    [Fact]
    public void Signature_Image_Takes_A_Png_Data_Url_Only()
    {
        SignatureImage.FromDataUrl(SignatureImage.ToDataUrl(Png)).ShouldBe(Png);

        foreach (var bad in new[] { null, "", "data:image/jpeg;base64,AAAA", "data:image/png;base64,@@@", "data:image/png;base64,QUJDREVGR0hJ" })
        {
            Should.Throw<BusinessException>(() => SignatureImage.FromDataUrl(bad))
                .Code.ShouldBe(BlueDentalDomainErrorCodes.Billing.SignatureInvalid);
        }
    }

    private static AesGcmReceiptCipher Cipher(byte[] key) =>
        new(Options.Create(new ReceiptVaultOptions { Key = Convert.ToBase64String(key) }));
}
