using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

/// <summary>
/// Phương thức thanh toán — the MoMo and bank accounts the clinic collects into.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class PaymentAccountAppService : ApplicationService, IPaymentAccountAppService
{
    private readonly IRepository<PaymentAccount, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IBlobContainer _blobContainer;

    public PaymentAccountAppService(
        IRepository<PaymentAccount, Guid> repository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess,
        IBlobContainer blobContainer)
    {
        _repository = repository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
        _blobContainer = blobContainer;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<PaymentAccountDto>> GetListAsync(GetPaymentAccountListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.Kind.HasValue)
        {
            query = query.Where(x => x.Kind == input.Kind.Value);
        }

        if (input.IsActive.HasValue)
        {
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.HolderName.ToLower().Contains(term) ||
                (x.PhoneNumber != null && x.PhoneNumber.ToLower().Contains(term)) ||
                (x.BankName != null && x.BankName.ToLower().Contains(term)) ||
                (x.AccountNumber != null && x.AccountNumber.ToLower().Contains(term)));
        }

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PaymentAccountDto>(
            totalCount,
            ObjectMapper.Map<List<PaymentAccount>, List<PaymentAccountDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PaymentAccountDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        return ObjectMapper.Map<PaymentAccount, PaymentAccountDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<PaymentAccountDto> CreateAsync(CreatePaymentAccountDto input)
    {
        // The header can switch branches, so the record lands in the one the
        // caller named — checked against what this account may write to.
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId,
            _branchResolver.GetRequiredClinicBranchId());

        var id = GuidGenerator.Create();
        var entity = input.Kind switch
        {
            PaymentAccountKind.MoMo => PaymentAccount.CreateMoMo(
                id, clinicBranchId, input.PhoneNumber ?? string.Empty, input.HolderName),
            PaymentAccountKind.Bank => PaymentAccount.CreateBank(
                id, clinicBranchId, input.BankName ?? string.Empty, input.HolderName,
                input.AccountNumber ?? string.Empty),
            _ => throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.UnknownPaymentAccountKind,
                $"'{input.Kind}' is not a payment account kind the reference offers.")
        };

        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<PaymentAccount, PaymentAccountDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PaymentAccountDto> UpdateAsync(Guid id, UpdatePaymentAccountDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        entity.Update(input.HolderName, input.PhoneNumber, input.BankName, input.AccountNumber);

        if (input.IsActive)
        {
            entity.Activate();
        }
        else
        {
            entity.Deactivate();
        }

        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<PaymentAccount, PaymentAccountDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        var blobName = entity.QrImageBlobName;

        await _repository.DeleteAsync(id, autoSave: true);
        await DeleteBlobAsync(blobName);
    }

    /// <summary>
    /// "Tải ảnh QR". The image is a second step after the account row exists —
    /// the blob is named after the account, so there is nothing to name it with
    /// before then.
    /// </summary>
    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PaymentAccountDto> UploadQrImageAsync(Guid id, UploadPaymentAccountQrImageDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        if (input.File == null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidQrImageFile,
                "No file was uploaded.");
        }

        await using var stream = input.File.GetStream();
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);

        var fileName = input.File.FileName ?? "qr";
        // A new blob name per upload, so a replaced QR cannot be served from a
        // stale CDN or browser cache under the old name.
        var blobName = $"payment-accounts/{entity.ClinicBranchId}/{id}/{GuidGenerator.Create()}{Path.GetExtension(fileName)}";

        // The size is only known once the stream has been read, and the domain
        // decides whether it is acceptable — so validate before storing.
        var replaced = entity.AttachQrImage(
            blobName,
            fileName,
            input.File.ContentType ?? string.Empty,
            buffer.Length);

        buffer.Position = 0;
        await _blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        await _repository.UpdateAsync(entity, autoSave: true);
        await DeleteBlobAsync(replaced);

        return ObjectMapper.Map<PaymentAccount, PaymentAccountDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<IRemoteStreamContent> GetQrImageAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        if (entity.QrImageBlobName is null)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.QrImageNotFound,
                "This payment method has no QR image.");
        }

        var stream = await _blobContainer.GetAsync(entity.QrImageBlobName);

        return new RemoteStreamContent(
            stream,
            entity.QrImageFileName,
            entity.QrImageContentType ?? "application/octet-stream");
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<PaymentAccountDto> DeleteQrImageAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        var removed = entity.ClearQrImage();

        await _repository.UpdateAsync(entity, autoSave: true);
        await DeleteBlobAsync(removed);

        return ObjectMapper.Map<PaymentAccount, PaymentAccountDto>(entity);
    }

    /// <summary>
    /// The row is the record of truth; a blob that has already gone missing must
    /// not fail the request that was only trying to get rid of it.
    /// </summary>
    private async Task DeleteBlobAsync(string? blobName)
    {
        if (!string.IsNullOrEmpty(blobName))
        {
            await _blobContainer.DeleteAsync(blobName);
        }
    }
}
