using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp;
using Volo.Abp.Application.Services;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using BlueDental.Organizations;
using BlueDental.Timekeeping;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Identity;
using Volo.Abp.Identity;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Staff;

[Authorize(BlueDentalPermissions.Staff.Default)]
public class StaffAppService(
    IIdentityUserRepository userRepository,
    IdentityUserManager userManager,
    IIdentityRoleRepository roleRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IRepository<TimeKeepingRecord, Guid> timeKeepingRepository,
    ICurrentClinicBranchResolver branchResolver,
    IBlobContainer blobContainer) : ApplicationService, IStaffAppService
{
    private const long MaxAvatarBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly HashSet<string> AllowedContentTypes = ["image/png", "image/jpeg", "image/webp"];
    // Vietnamese mobile number: starts with 0, exactly 10 digits.
    private static readonly Regex PhoneRegex = new(@"^0\d{9}$", RegexOptions.Compiled);

    // "HH:mm" — 00:00 to 23:59.
    private static readonly Regex TimeRegex = new(@"^([01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);

    [Authorize(BlueDentalPermissions.Staff.View)]
    public async Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffListInput input)
    {
        // When filtering by branch, first find which staff IDs belong to that branch.
        HashSet<Guid>? branchStaffIds = null;
        if (input.BranchId.HasValue)
        {
            var assignments = await assignmentRepository.GetListAsync(
                a => a.ClinicBranchId == input.BranchId.Value);
            branchStaffIds = assignments.Select(a => a.StaffId).ToHashSet();
        }

        // The identity repository's own `filter` is case-sensitive on PostgreSQL,
        // so "thu" would miss "Lê Thu Hà". The pickers search as the user types,
        // which makes that a real miss rather than a curiosity — so the term is
        // matched here instead, the way the catalog list matches its own.
        var offStaffIds = input.AvailableOn.HasValue
            ? await GetDayOffStaffIdsAsync(input.AvailableOn.Value, input.BranchId)
            : null;

        var term = input.Filter?.Trim();
        var needsInMemoryFilter = branchStaffIds != null || offStaffIds != null
            || input.IsActive.HasValue || !term.IsNullOrEmpty() || input.Role.HasValue;

        var users = await userRepository.GetListAsync(
            sorting: input.Sorting ?? "Name",
            maxResultCount: needsInMemoryFilter ? int.MaxValue : input.MaxResultCount,
            skipCount: needsInMemoryFilter ? 0 : input.SkipCount);

        if (!term.IsNullOrEmpty())
        {
            users = users.Where(u => MatchesTerm(u, term!)).ToList();
        }

        if (branchStaffIds != null)
        {
            users = users.Where(u => branchStaffIds.Contains(u.Id)).ToList();
        }

        if (input.IsActive.HasValue)
        {
            users = users.Where(u => u.IsActive == input.IsActive.Value).ToList();
        }

        if (offStaffIds != null)
        {
            users = users.Where(u => !offStaffIds.Contains(u.Id)).ToList();
        }

        if (input.Role.HasValue)
        {
            users = users.Where(u => FillsRole(u, input.Role.Value)).ToList();
        }

        var totalCount = users.Count;
        var paged = needsInMemoryFilter
            ? users.Skip(input.SkipCount).Take(input.MaxResultCount).ToList()
            : users;

        return new PagedResultDto<StaffDto>(totalCount, await MapListAsync(paged));
    }

    /// <summary>
    /// Staff who pressed OFF on Chấm công for that clinic day. A day off is
    /// recorded per branch, so it is read at the branch the form is booking
    /// into — the explicit filter, else the branch on the request.
    /// </summary>
    private async Task<HashSet<Guid>> GetDayOffStaffIdsAsync(DateOnly day, Guid? branchId)
    {
        var branch = branchId ?? branchResolver.ClinicBranchId ?? branchResolver.OwnClinicBranchId;
        var records = await timeKeepingRepository.GetListAsync(r =>
            r.WorkDate == day
            && r.Registration == WorkRegistration.DayOff
            && (branch == null || r.ClinicBranchId == branch));
        return records.Select(r => r.StaffId).ToHashSet();
    }

    /// <summary>
    /// Whether a member of staff answers to what was typed — the same fields the
    /// identity repository looks at, matched without regard to case or spacing.
    /// </summary>
    /// <summary>The Bác sĩ / Phụ tá / Y sĩ boxes of the staff form, as a picker reads them.</summary>
    private static bool FillsRole(Volo.Abp.Identity.IdentityUser user, StaffPickerRole role) => role switch
    {
        StaffPickerRole.Dentist => user.ExtraProperties.GetOrDefault("IsDentist") is true,
        StaffPickerRole.Assistant => user.ExtraProperties.GetOrDefault("IsAssistant") is true
            || user.ExtraProperties.GetOrDefault("IsHygienist") is true,
        _ => false,
    };

    private static bool MatchesTerm(Volo.Abp.Identity.IdentityUser user, string term)
    {
        var needle = term.ToLowerInvariant();
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !x.IsNullOrWhiteSpace()));

        return Contains(user.UserName, needle)
            || Contains(user.Name, needle)
            || Contains(user.Surname, needle)
            || Contains(fullName, needle)
            || Contains(user.Email, needle)
            || Contains(user.PhoneNumber, needle);

        static bool Contains(string? value, string needle) =>
            !value.IsNullOrWhiteSpace() && value!.ToLowerInvariant().Contains(needle);
    }

    [Authorize(BlueDentalPermissions.Staff.View)]
    public async Task<StaffDto> GetAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        return await MapAsync(user);
    }

    /// <summary>
    /// "Chức vụ" already in use, for the field's suggestions: one clinic's
    /// list grows as people type new ones, without a separate catalogue.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<List<string>> GetPositionsAsync()
    {
        var users = await userRepository.GetListAsync();
        return users
            .Select(u => u.ExtraProperties.GetOrDefault(PositionProperty) as string)
            .OfType<string>()
            .Where(p => p.Length > 0)
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .OrderBy(p => p, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<List<string>> GetRoleNamesAsync()
    {
        var roles = await roleRepository.GetListAsync();
        return roles.Select(r => r.Name).OrderBy(name => name).ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Create)]
    public async Task<StaffDto> CreateAsync(CreateStaffDto input)
    {
        ValidateExtendedFields(input.PhoneNumber, input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

        var existingByEmail = await userRepository.FindByNormalizedEmailAsync(input.Email.ToUpperInvariant());
        if (existingByEmail is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.DuplicateEmail);
        }

        var userName = await GenerateUniqueUserNameAsync(input.UserName, input.Email);

        var user = new Volo.Abp.Identity.IdentityUser(GuidGenerator.Create(), userName, input.Email)
        {
            Name = input.Name,
            Surname = input.Surname
        };

        user.SetIsActive(input.IsActive);

        if (!input.PhoneNumber.IsNullOrWhiteSpace())
        {
            user.SetPhoneNumber(input.PhoneNumber, confirmed: false);
        }

        SetExtraProperties(user, input.Address, input.ProvinceId, input.DistrictId, input.WardId,
            input.IsDentist, input.IsAssistant, input.IsHygienist, input.AllowLoginOutsideOffice, input.AllowLoginOutsideHours,
            input.MaxDiscountPercent, input.MaxDiscountAmount,
            input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);
        SetEmployment(user, input);

        (await userManager.CreateAsync(user, input.Password)).CheckErrors();

        if (input.RoleNames.Count > 0)
        {
            (await userManager.AddToRolesAsync(user, input.RoleNames)).CheckErrors();
        }

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
    public async Task<StaffDto> UpdateAsync(Guid id, UpdateStaffDto input)
    {
        ValidateExtendedFields(input.PhoneNumber, input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);

        var user = await userRepository.GetAsync(id);

        user.Name = input.Name;
        user.Surname = input.Surname;
        user.SetIsActive(input.IsActive);
        (await userManager.SetEmailAsync(user, input.Email)).CheckErrors();
        (await userManager.SetPhoneNumberAsync(user, input.PhoneNumber)).CheckErrors();

        SetExtraProperties(user, input.Address, input.ProvinceId, input.DistrictId, input.WardId,
            input.IsDentist, input.IsAssistant, input.IsHygienist, input.AllowLoginOutsideOffice, input.AllowLoginOutsideHours,
            input.MaxDiscountPercent, input.MaxDiscountAmount,
            input.MorningStartTime, input.MorningEndTime,
            input.AfternoonStartTime, input.AfternoonEndTime);
        SetEmployment(user, input);

        // Roles are replaced wholesale: the form shows the full set, not a delta.
        var current = await userManager.GetRolesAsync(user);
        (await userManager.RemoveFromRolesAsync(user, current)).CheckErrors();
        if (input.RoleNames.Count > 0)
        {
            (await userManager.AddToRolesAsync(user, input.RoleNames)).CheckErrors();
        }

        if (!string.IsNullOrWhiteSpace(input.Password))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            (await userManager.ResetPasswordAsync(user, token, input.Password)).CheckErrors();
        }

        (await userManager.UpdateAsync(user)).CheckErrors();

        await ReplaceBranchAssignmentsAsync(user.Id, input.BranchIds);
        return await MapAsync(user);
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        if (CurrentUser.Id == id)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Organizations.CannotDeleteActiveClinic,
                "You cannot delete the account you are signed in with.");
        }

        var user = await userRepository.GetAsync(id);

        // Leaving the assignments behind would silently re-scope a recreated user.
        await ReplaceBranchAssignmentsAsync(id, []);
        (await userManager.DeleteAsync(user)).CheckErrors();
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
    public async Task<AvatarResultDto> UploadAvatarAsync(Guid id, RemoteStreamContent file)
    {
        if (file == null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarFileRequired, "No file uploaded.");

        var contentType = file.ContentType ?? string.Empty;
        if (!AllowedContentTypes.Contains(contentType))
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.UnsupportedAvatarType, "Only PNG, JPEG, and WebP images are allowed.");

        var user = await userRepository.GetAsync(id);

        using var buffer = new MemoryStream();
        await file.GetStream().CopyToAsync(buffer);

        if (buffer.Length > MaxAvatarBytes)
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarTooLarge, "Avatar file must be 5 MB or smaller.");

        var ext = contentType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };

        // Delete previous avatar blob if exists
        var previousBlob = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;
        if (!previousBlob.IsNullOrWhiteSpace())
        {
            await blobContainer.DeleteAsync(previousBlob!);
        }

        var blobName = $"staff/avatars/{id}{ext}";
        buffer.Position = 0;
        await blobContainer.SaveAsync(blobName, buffer, overrideExisting: true);

        user.ExtraProperties["AvatarBlobName"] = blobName;
        (await userManager.UpdateAsync(user)).CheckErrors();

        var url = $"/api/v1/app/staff/{id}/avatar";
        return new AvatarResultDto { Url = url };
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Update)]
    public async Task DeleteAvatarAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var blobName = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;

        if (!blobName.IsNullOrWhiteSpace())
        {
            await blobContainer.DeleteAsync(blobName!);
            user.ExtraProperties["AvatarBlobName"] = null;
            (await userManager.UpdateAsync(user)).CheckErrors();
        }
    }

    [Authorize(BlueDentalAbilityPermissions.Staff.Read)]
    public async Task<Stream> GetAvatarContentAsync(Guid id)
    {
        var user = await userRepository.GetAsync(id);
        var blobName = user.ExtraProperties.GetOrDefault("AvatarBlobName") as string;

        if (blobName.IsNullOrWhiteSpace())
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.AvatarNotFound, "No avatar found.");

        return await blobContainer.GetAsync(blobName!);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async Task<string> GenerateUniqueUserNameAsync(string? preferredUserName, string email)
    {
        var baseName = !preferredUserName.IsNullOrWhiteSpace()
            ? preferredUserName!
            : email.Split('@')[0];

        var candidate = baseName;
        var suffix = 1;
        while (await userRepository.FindByNormalizedUserNameAsync(
                   candidate.ToUpperInvariant()) is not null)
        {
            candidate = $"{baseName}{suffix}";
            suffix++;
        }

        return candidate;
    }

    private static void ValidateExtendedFields(
        string? phoneNumber,
        string? morningStartTime,
        string? morningEndTime,
        string? afternoonStartTime,
        string? afternoonEndTime)
    {
        if (!phoneNumber.IsNullOrWhiteSpace() && !PhoneRegex.IsMatch(phoneNumber!))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidPhoneNumber)
                .WithData("phoneNumber", phoneNumber);
        }

        foreach (var (label, value) in new[]
        {
            ("morningStartTime",   morningStartTime),
            ("morningEndTime",     morningEndTime),
            ("afternoonStartTime", afternoonStartTime),
            ("afternoonEndTime",   afternoonEndTime),
        })
        {
            if (!value.IsNullOrWhiteSpace() && !TimeRegex.IsMatch(value!))
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidTimeFormat)
                    .WithData("field", label)
                    .WithData("value", value);
            }
        }
    }

    /// <summary>
    /// Writes all 15 extended-profile fields as ExtraProperties on the IdentityUser.
    /// Null/empty strings are stored as null so reads can use a clean null-check.
    /// </summary>
    private static void SetExtraProperties(
        Volo.Abp.Identity.IdentityUser user,
        string? address,
        string? provinceId,
        string? districtId,
        string? wardId,
        bool isDentist,
        bool isAssistant,
        bool isHygienist,
        bool allowLoginOutsideOffice,
        bool allowLoginOutsideHours,
        decimal? maxDiscountPercent,
        decimal? maxDiscountAmount,
        string? morningStartTime,
        string? morningEndTime,
        string? afternoonStartTime,
        string? afternoonEndTime)
    {
        user.ExtraProperties["Address"]           = address.IsNullOrWhiteSpace() ? null : address;
        user.ExtraProperties["ProvinceId"]        = provinceId.IsNullOrWhiteSpace() ? null : provinceId;
        user.ExtraProperties["DistrictId"]        = districtId.IsNullOrWhiteSpace() ? null : districtId;
        user.ExtraProperties["WardId"]            = wardId.IsNullOrWhiteSpace() ? null : wardId;
        user.ExtraProperties["IsDentist"]         = isDentist;
        user.ExtraProperties["IsAssistant"]       = isAssistant;
        user.ExtraProperties["IsHygienist"]       = isHygienist;
        user.ExtraProperties[BlueDentalConsts.UserAllowLoginOutsideOfficePropertyName] = allowLoginOutsideOffice;
        user.ExtraProperties[BlueDentalConsts.UserAllowLoginOutsideHoursPropertyName] = allowLoginOutsideHours;
        DiscountLimit.EnsureValid(maxDiscountPercent, maxDiscountAmount);
        user.ExtraProperties[BlueDentalConsts.UserMaxDiscountPercentPropertyName] = maxDiscountPercent;
        user.ExtraProperties[BlueDentalConsts.UserMaxDiscountAmountPropertyName] = maxDiscountAmount;
        user.ExtraProperties["MorningStartTime"]  = morningStartTime.IsNullOrWhiteSpace() ? null : morningStartTime;
        user.ExtraProperties["MorningEndTime"]    = morningEndTime.IsNullOrWhiteSpace() ? null : morningEndTime;
        user.ExtraProperties["AfternoonStartTime"] = afternoonStartTime.IsNullOrWhiteSpace() ? null : afternoonStartTime;
        user.ExtraProperties["AfternoonEndTime"]  = afternoonEndTime.IsNullOrWhiteSpace() ? null : afternoonEndTime;
    }

    private async Task ReplaceBranchAssignmentsAsync(Guid staffId, List<Guid> branchIds)
    {
        var existing = await assignmentRepository.GetListAsync(a => a.StaffId == staffId);
        if (existing.Count > 0)
        {
            await assignmentRepository.DeleteManyAsync(existing, autoSave: true);
        }

        foreach (var branchId in branchIds.Distinct())
        {
            await assignmentRepository.InsertAsync(
                StaffBranchAssignment.Assign(GuidGenerator.Create(), staffId, branchId),
                autoSave: true);
        }
    }

    private async Task<StaffDto> MapAsync(Volo.Abp.Identity.IdentityUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var assignments = await assignmentRepository.GetListAsync(a => a.StaffId == user.Id);
        return Map(user, roles, assignments.Select(a => a.ClinicBranchId));
    }

    /// <summary>
    /// A whole page in two queries — roles, then branches — rather than two per
    /// person: Tiếp nhận asks for every staff member of the branch once per day
    /// on the board (R-693).
    /// </summary>
    private async Task<List<StaffDto>> MapListAsync(List<Volo.Abp.Identity.IdentityUser> users)
    {
        if (users.Count == 0) return [];

        var ids = users.Select(u => u.Id).ToList();
        var rolesByUser = (await userRepository.GetRoleNamesAsync(ids))
            .ToDictionary(r => r.Id, r => r.RoleNames);
        var branchesByUser = (await assignmentRepository.GetListAsync(a => ids.Contains(a.StaffId)))
            .ToLookup(a => a.StaffId, a => a.ClinicBranchId);

        return users
            .Select(u => Map(u, rolesByUser.GetValueOrDefault(u.Id) ?? [], branchesByUser[u.Id]))
            .ToList();
    }

    private static StaffDto Map(
        Volo.Abp.Identity.IdentityUser user, IEnumerable<string> roles, IEnumerable<Guid> branchIds)
    {
        return new StaffDto
        {
            Id = user.Id,
            UserName = user.UserName ?? string.Empty,
            Name = user.Name,
            Surname = user.Surname,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            IsActive = user.IsActive,
            CreationTime = user.CreationTime,
            RoleNames = roles.ToList(),
            BranchIds = branchIds.ToList(),

            // Extended profile — read back from ExtraProperties
            Address            = user.ExtraProperties.GetOrDefault("Address") as string,
            ProvinceId         = user.ExtraProperties.GetOrDefault("ProvinceId") as string,
            DistrictId         = user.ExtraProperties.GetOrDefault("DistrictId") as string,
            WardId             = user.ExtraProperties.GetOrDefault("WardId") as string,
            IsDentist          = user.ExtraProperties.GetOrDefault("IsDentist") is true,
            IsAssistant        = user.ExtraProperties.GetOrDefault("IsAssistant") is true,
            IsHygienist        = user.ExtraProperties.GetOrDefault("IsHygienist") is true,
            AllowLoginOutsideOffice = user.ExtraProperties
                .GetOrDefault(BlueDentalConsts.UserAllowLoginOutsideOfficePropertyName) is true,
            AllowLoginOutsideHours = user.ExtraProperties
                .GetOrDefault(BlueDentalConsts.UserAllowLoginOutsideHoursPropertyName) is true,
            MaxDiscountPercent = ReadDecimal(user, BlueDentalConsts.UserMaxDiscountPercentPropertyName),
            MaxDiscountAmount  = ReadDecimal(user, BlueDentalConsts.UserMaxDiscountAmountPropertyName),
            MorningStartTime   = user.ExtraProperties.GetOrDefault("MorningStartTime") as string,
            MorningEndTime     = user.ExtraProperties.GetOrDefault("MorningEndTime") as string,
            AfternoonStartTime = user.ExtraProperties.GetOrDefault("AfternoonStartTime") as string,
            AfternoonEndTime   = user.ExtraProperties.GetOrDefault("AfternoonEndTime") as string,
            AvatarUrl          = (user.ExtraProperties.GetOrDefault("AvatarBlobName") as string) is not null
                                     ? $"/api/v1/app/staff/{user.Id}/avatar"
                                     : null,

            // Hồ sơ công việc (Cụm 11 mục 1)
            Position                       = user.ExtraProperties.GetOrDefault(PositionProperty) as string,
            PracticeCertificateNumber      = user.ExtraProperties.GetOrDefault(CertificateNumberProperty) as string,
            PracticeCertificateIssuedOn    = ReadDate(user, CertificateIssuedOnProperty),
            PracticeCertificateIssuedPlace = user.ExtraProperties.GetOrDefault(CertificateIssuedPlaceProperty) as string,
            ContractType                   = ReadContractType(user),
            ContractStartDate              = ReadDate(user, ContractStartProperty),
            ContractEndDate                = ReadDate(user, ContractEndProperty),
        };
    }

    // --- Hồ sơ công việc (Cụm 11 mục 1): extra properties of the IdentityUser ---

    private const string PositionProperty = "Position";
    private const string CertificateNumberProperty = "PracticeCertificateNumber";
    private const string CertificateIssuedOnProperty = "PracticeCertificateIssuedOn";
    private const string CertificateIssuedPlaceProperty = "PracticeCertificateIssuedPlace";
    private const string ContractTypeProperty = "ContractType";
    private const string ContractStartProperty = "ContractStartDate";
    private const string ContractEndProperty = "ContractEndDate";
    private const string DateFormat = "yyyy-MM-dd";

    private static void SetEmployment(Volo.Abp.Identity.IdentityUser user, IStaffEmploymentFields input)
    {
        StaffEmployment.EnsureValid(
            input.ContractStartDate,
            input.ContractEndDate,
            input.PracticeCertificateIssuedOn,
            ClinicCalendar.DateOf(DateTimeOffset.UtcNow));

        if (input.ContractType is { } type && !Enum.IsDefined(type))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.InvalidContractType);
        }

        user.ExtraProperties[PositionProperty] = StaffEmployment.Clean(input.Position);
        user.ExtraProperties[CertificateNumberProperty] = StaffEmployment.Clean(input.PracticeCertificateNumber);
        user.ExtraProperties[CertificateIssuedOnProperty] = input.PracticeCertificateIssuedOn?.ToString(DateFormat);
        user.ExtraProperties[CertificateIssuedPlaceProperty] = StaffEmployment.Clean(input.PracticeCertificateIssuedPlace);
        user.ExtraProperties[ContractTypeProperty] = input.ContractType.HasValue ? (int)input.ContractType.Value : null;
        user.ExtraProperties[ContractStartProperty] = input.ContractStartDate?.ToString(DateFormat);
        user.ExtraProperties[ContractEndProperty] = input.ContractEndDate?.ToString(DateFormat);
    }

    /// <summary>
    /// Stored as "yyyy-MM-dd"; ABP's JSON reader hands a string that looks
    /// like a date back as a <see cref="DateTime"/>, so both shapes are read.
    /// </summary>
    private static DateOnly? ReadDate(Volo.Abp.Identity.IdentityUser user, string name) =>
        user.ExtraProperties.GetOrDefault(name) switch
        {
            DateTime dateTime => DateOnly.FromDateTime(dateTime),
            DateOnly date => date,
            var value when DateOnly.TryParseExact(value?.ToString(), DateFormat,
                System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var parsed)
                => parsed,
            _ => null,
        };

    private static StaffContractType? ReadContractType(Volo.Abp.Identity.IdentityUser user) =>
        int.TryParse(user.ExtraProperties.GetOrDefault(ContractTypeProperty)?.ToString(), out var value)
        && Enum.IsDefined(typeof(StaffContractType), (short)value)
            ? (StaffContractType)value
            : null;

    private static decimal? ReadDecimal(Volo.Abp.Identity.IdentityUser user, string name) =>
        user.ExtraProperties.GetOrDefault(name) switch
        {
            null => null,
            decimal value => value,
            IConvertible value => Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture),
            var other => decimal.TryParse(other.ToString(), System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture, out var parsed) ? parsed : null,
        };
}
