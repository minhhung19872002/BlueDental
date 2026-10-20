using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.StaffNotes;

/// <summary>
/// The header's "Thêm ghi chú" dialog (F-74, BlueDental-local). Every signed-in
/// account may use it, so there is no permission of its own; what each caller
/// reads and changes is decided by authorship and branch:
///
/// - Cá nhân: the caller's own notes, whichever branch is selected.
/// - Chung: the notes of the selected branch, or of every branch the account
///   may open when "Tất cả chi nhánh" is selected. A new one lands in the
///   selected branch (the account's own when none is named).
/// - Only the author edits or deletes; another author's Cá nhân note does not
///   exist as far as the caller can tell.
/// </summary>
[Authorize]
public class StaffNoteAppService(
    IRepository<StaffNote, Guid> repository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver,
    BranchAccessChecker branchAccess) : BlueDentalAppService, IStaffNoteAppService
{
    public async Task<PagedResultDto<StaffNoteDto>> GetListAsync(GetStaffNoteListInput input)
    {
        var userId = CurrentUser.GetId();
        var query = (await repository.GetQueryableAsync()).Where(n => n.Scope == input.Scope);

        if (input.Scope == StaffNoteScope.Personal)
        {
            query = query.Where(n => n.CreatorId == userId);
        }
        else
        {
            var branchIds = await branchAccess.ResolveFilterAsync(branchResolver.ClinicBranchId);
            if (branchIds.Count > 0)
            {
                query = query.Where(n => n.ClinicBranchId != null && branchIds.Contains(n.ClinicBranchId.Value));
            }
        }

        // Marks fold away on both sides: "goi lai duc" finds "Gọi lại BS Đức", and the other way round.
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(n => DbText.Unaccent(n.Content.ToLower()).Contains(DbText.Unaccent(term)));
        }

        var totalCount = await AsyncExecuter.CountAsync(query);
        var notes = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(n => n.CreationTime)
            .ThenByDescending(n => n.Id)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<StaffNoteDto>(totalCount, await MapAsync(notes, userId));
    }

    public async Task<StaffNoteDto> CreateAsync(CreateStaffNoteDto input)
    {
        var userId = CurrentUser.GetId();
        StaffNote note;

        switch (input.Scope)
        {
            case StaffNoteScope.Personal:
                note = StaffNote.CreatePersonal(GuidGenerator.Create(), input.Content);
                break;
            case StaffNoteScope.Shared:
                var branchId = branchResolver.ClinicBranchId ?? branchResolver.OwnClinicBranchId
                    ?? throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.BranchRequired);
                await branchAccess.CheckAsync(branchId);
                note = StaffNote.CreateShared(GuidGenerator.Create(), branchId, input.Content);
                break;
            default:
                throw new BusinessException(BlueDentalDomainErrorCodes.StaffNotes.InvalidScope);
        }

        await repository.InsertAsync(note, autoSave: true);
        return (await MapAsync([note], userId))[0];
    }

    public async Task<StaffNoteDto> UpdateAsync(Guid id, UpdateStaffNoteDto input)
    {
        var userId = CurrentUser.GetId();
        var note = await GetVisibleAsync(id, userId);

        note.Edit(userId, input.Content);
        await repository.UpdateAsync(note, autoSave: true);

        return (await MapAsync([note], userId))[0];
    }

    public async Task DeleteAsync(Guid id)
    {
        var userId = CurrentUser.GetId();
        var note = await GetVisibleAsync(id, userId);

        note.EnsureOwnedBy(userId);
        await repository.DeleteAsync(note);
    }

    /// <summary>
    /// The note as the caller may see it: someone else's Cá nhân note is
    /// reported missing rather than forbidden, and a Chung note needs access to
    /// its branch.
    /// </summary>
    private async Task<StaffNote> GetVisibleAsync(Guid id, Guid userId)
    {
        var note = await repository.FindAsync(id);
        if (note is null || (note.Scope == StaffNoteScope.Personal && !note.IsOwnedBy(userId)))
        {
            throw new EntityNotFoundException(typeof(StaffNote), id);
        }

        if (note.ClinicBranchId is { } branchId)
        {
            await branchAccess.CheckAsync(branchId);
        }

        return note;
    }

    private async Task<List<StaffNoteDto>> MapAsync(IReadOnlyList<StaffNote> notes, Guid userId)
    {
        var creatorIds = notes
            .Where(n => n.CreatorId.HasValue)
            .Select(n => n.CreatorId!.Value)
            .Distinct()
            .ToList();
        var names = creatorIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await userRepository.GetListByIdsAsync(creatorIds)).ToDictionary(u => u.Id, FullName);

        return notes.Select(n => new StaffNoteDto
        {
            Id = n.Id,
            Scope = n.Scope,
            ClinicBranchId = n.ClinicBranchId,
            Content = n.Content,
            CreatorId = n.CreatorId,
            CreatorName = n.CreatorId is { } creator ? names.GetValueOrDefault(creator) : null,
            CreationTime = n.CreationTime,
            LastModificationTime = n.LastModificationTime,
            CanEdit = n.IsOwnedBy(userId),
        }).ToList();
    }

    private static string FullName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}
