using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

/// <summary>
/// Nhà cung cấp Labo — /labo/supplier.
///
/// Branch-scoped like every other clinic record: the caller names the branch it
/// is looking at and the checker narrows that to what the account may see.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class LaboSupplierAppService : ApplicationService, ILaboSupplierAppService
{
    private const long MaxLogoBytes = 5 * 1024 * 1024;
    private static readonly HashSet<string> AllowedLogoTypes =
        ["image/png", "image/jpeg", "image/webp"];

    private readonly IRepository<LaboSupplier, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IBlobContainer _blobContainer;

    public LaboSupplierAppService(
        IRepository<LaboSupplier, Guid> repository,
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
    public async Task<PagedResultDto<LaboSupplierDto>> GetListAsync(GetLaboSupplierListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        // Every word has to appear somewhere in the row, in any field and in any
        // order — the same rule the catalog screens search by.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(term) ||
                (x.Phone != null && x.Phone.ToLower().Contains(term)) ||
                (x.Email != null && x.Email.ToLower().Contains(term)) ||
                (x.ContactPerson != null && x.ContactPerson.ToLower().Contains(term)) ||
                (x.Address != null && x.Address.ToLower().Contains(term)));
        }

        if (input.IsActive.HasValue)
        {
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        }

        var totalCount = query.Count();
        var items = query
            // The reference orders this list by most recently touched.
            .OrderByDescending(x => x.LastModificationTime ?? x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<LaboSupplierDto>(
            totalCount,
            ObjectMapper.Map<List<LaboSupplier>, List<LaboSupplierDto>>(items));
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<LaboSupplierDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<LaboSupplierDto> CreateAsync(CreateLaboSupplierDto input)
    {
        var clinicBranchId = await _branchAccess.ResolveWriteTargetAsync(
            input.ClinicBranchId ?? Guid.Empty,
            _branchResolver.GetRequiredClinicBranchId());

        var entity = LaboSupplier.Create(GuidGenerator.Create(), clinicBranchId, input.Name.Trim());
        Apply(entity, input);

        await _repository.InsertAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboSupplierDto> UpdateAsync(Guid id, UpdateLaboSupplierDto input)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        Apply(entity, input);

        await _repository.UpdateAsync(entity, autoSave: true);
        return ObjectMapper.Map<LaboSupplier, LaboSupplierDto>(entity);
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>
    /// The logo, stored in MinIO and served back through this API rather than
    /// by a public URL — the same shape the staff avatar uses.
    /// </summary>
    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<LaboSupplierLogoDto> UploadLogoAsync(Guid id, IRemoteStreamContent file)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        var contentType = file.ContentType ?? string.Empty;
        if (!AllowedLogoTypes.Contains(contentType))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.LogoNotAnImage,
                "A supplier logo has to be a PNG, JPEG or WebP image.");
        }

        using var buffer = new MemoryStream();
        await file.GetStream().CopyToAsync(buffer);

        if (buffer.Length > MaxLogoBytes)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.LogoTooLarge,
                "A supplier logo has to be 5 MB or smaller.");
        }

        // The old blob goes first, so a replaced logo leaves nothing behind.
        if (!string.IsNullOrWhiteSpace(entity.LogoFileId))
        {
            await _blobContainer.DeleteAsync(entity.LogoFileId!);
        }

        var extension = contentType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };
        var blobName = $"labo/supplier/{id}{extension}";

        buffer.Position = 0;
        await _blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        var url = $"/api/v1/app/labo-suppliers/{id}/logo";
        entity.SetLogo(blobName, url);
        await _repository.UpdateAsync(entity, autoSave: true);

        return new LaboSupplierLogoDto { Url = url };
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task DeleteLogoAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        if (string.IsNullOrWhiteSpace(entity.LogoFileId))
        {
            return;
        }

        await _blobContainer.DeleteAsync(entity.LogoFileId!);
        entity.SetLogo(null, null);
        await _repository.UpdateAsync(entity, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<Stream> GetLogoContentAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entity.ClinicBranchId);

        if (string.IsNullOrWhiteSpace(entity.LogoFileId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Labo.LogoNotFound,
                "This supplier has no logo.");
        }

        return await _blobContainer.GetAsync(entity.LogoFileId!);
    }

    /// <summary>
    /// Blank is nothing, not an empty string: the dialog sends "" for a field
    /// the user cleared, and storing that would make "no tax code" and "a tax
    /// code of nothing" two different states.
    /// </summary>
    private static void Apply(LaboSupplier entity, LaboSupplierInputDto input) =>
        entity.SetDetails(
            input.Name.Trim(),
            Blank(input.Phone),
            Blank(input.Email),
            Blank(input.ContactPerson),
            Blank(input.TaxCode),
            Blank(input.ProvinceCode),
            Blank(input.WardCode),
            Blank(input.Address));

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
