using System;
using System.Threading.Tasks;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Auditing;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Users;

namespace BlueDental.Billing;

/// <summary>
/// The accountant's saved Ký điện tử signature (P2910_02): each user has
/// their own, sealed like the customer's, and every save leaves a line in the
/// change log with its own time.
/// </summary>
public class AccountantSignatureVault(
    IRepository<AccountantSignature, Guid> signatures,
    IRepository<AccountantSignatureChange, Guid> changes,
    IReceiptCipher cipher,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    public Task<AccountantSignature?> OfAsync(Guid userId) =>
        signatures.FirstOrDefaultAsync(x => x.UserId == userId);

    public byte[] PngOf(AccountantSignature signature) => cipher.Decrypt(signature.SignatureCipher);

    /// <summary>Lưu chữ ký / Dùng chữ ký này: the new one replaces the old.</summary>
    public async Task<AccountantSignature> SaveAsync(
        Guid userId, byte[] png, AccountantSignatureSource source, DateTimeOffset now)
    {
        var sealedPng = cipher.Encrypt(png);
        var signature = await OfAsync(userId);
        if (signature == null)
        {
            signature = AccountantSignature.Save(guidGenerator.Create(), userId, sealedPng, source, now);
            await signatures.InsertAsync(signature, autoSave: true);
        }
        else
        {
            signature.Replace(sealedPng, source, now);
            await signatures.UpdateAsync(signature, autoSave: true);
        }

        await changes.InsertAsync(
            new AccountantSignatureChange(guidGenerator.Create(), userId, source, now), autoSave: true);
        return signature;
    }
}

/// <summary>
/// Only ever the signed-in user's own signature. Not audited: the request
/// would put the drawing in the audit log in clear.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.Payment.Update)]
[DisableAuditing]
public class AccountantSignatureAppService(
    AccountantSignatureVault vault,
    PaymentReceiptContents receipts) : BlueDentalAppService, IAccountantSignatureAppService
{
    public async Task<AccountantSignatureDto?> GetMineAsync()
    {
        var signature = await vault.OfAsync(CurrentUser.GetId());
        return signature == null ? null : await ToDtoAsync(signature);
    }

    public async Task<AccountantSignatureDto> SaveMineAsync(SaveAccountantSignatureDto input)
    {
        var png = SignatureImage.FromDataUrl(
            input.SignatureDataUrl,
            AccountantSignatureConsts.MaxBytes,
            BlueDentalDomainErrorCodes.Billing.AccountantSignatureTooLarge);
        var signature = await vault.SaveAsync(CurrentUser.GetId(), png, input.Source, Clock.Now);
        return await ToDtoAsync(signature);
    }

    private async Task<AccountantSignatureDto> ToDtoAsync(AccountantSignature signature)
    {
        var names = await receipts.FullNamesAsync([signature.UserId]);
        return new AccountantSignatureDto
        {
            SignatureDataUrl = SignatureImage.ToDataUrl(vault.PngOf(signature)),
            Source = signature.Source,
            SavedAt = signature.SavedAt,
            UserName = PaymentReceiptContents.NameOf(names, signature.UserId) ?? CurrentUser.UserName ?? string.Empty
        };
    }
}
