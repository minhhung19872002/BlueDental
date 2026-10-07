using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;

namespace BlueDental.Marketing;

/// <summary>
/// The lookups a ticket write checks against other records: the open ticket a
/// phone already has, the patient it belongs to, the staff and tags it names,
/// and the next free code.
/// </summary>
public class TicketReferenceChecker(
    IRepository<Ticket, Guid> ticketRepository,
    IRepository<TicketTag, Guid> tagRepository,
    IRepository<Patient, Guid> patientRepository,
    IRepository<StaffBranchAssignment, Guid> assignmentRepository,
    IIdentityUserRepository userRepository,
    IAsyncQueryableExecuter asyncExecuter,
    IDataFilter dataFilter) : ITransientDependency
{
    public async Task<Ticket?> FindOpenByPhoneAsync(Guid branchId, string phone, Guid? exceptId) =>
        await ticketRepository.FirstOrDefaultAsync(t => t.ClinicBranchId == branchId
            && t.Phone == phone
            && t.Id != exceptId
            && (t.Status == TicketStatus.New || t.Status == TicketStatus.InCare || t.Status == TicketStatus.Booked));

    /// <summary>The branch's patient holding the phone, in any of the spellings records keep it in.</summary>
    public async Task<Guid?> FindPatientIdAsync(Guid branchId, string phone)
    {
        var variants = TicketPhone.Variants(phone).ToList();
        var ids = await asyncExecuter.ToListAsync((await patientRepository.GetQueryableAsync())
            .Where(p => p.BranchId == branchId && variants.Contains(p.Contact.PhoneNumber))
            .OrderBy(p => p.CreationTime)
            .Select(p => p.Id)
            .Take(1));
        return ids.Count == 0 ? null : ids[0];
    }

    public async Task CheckAssigneeAsync(Guid branchId, Guid assigneeId)
    {
        if (!await assignmentRepository.AnyAsync(a => a.StaffId == assigneeId && a.ClinicBranchId == branchId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.AssigneeNotInBranch);
        }
    }

    /// <summary>The branch's active staff, by name — the only ones <see cref="CheckAssigneeAsync"/> accepts.</summary>
    public async Task<List<TicketAssigneeDto>> AssigneesAsync(Guid branchId)
    {
        var staffIds = (await assignmentRepository.GetListAsync(a => a.ClinicBranchId == branchId))
            .Select(a => a.StaffId)
            .Distinct()
            .ToList();
        if (staffIds.Count == 0)
        {
            return [];
        }

        return (await userRepository.GetListByIdsAsync(staffIds))
            .Where(u => u.IsActive)
            .Select(u => new TicketAssigneeDto { Id = u.Id, Name = TicketMapper.FullName(u) })
            .OrderBy(a => a.Name)
            .ToList();
    }

    /// <summary>
    /// Checks the tags are the branch's own and live, and returns the shortest
    /// Thời gian xử lý among them (null when none sets one).
    /// </summary>
    public async Task<int?> ProcessingDaysAsync(Guid branchId, IReadOnlyCollection<Guid> tagIds)
    {
        var ids = tagIds.Where(x => x != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
        {
            return null;
        }

        var tags = await tagRepository.GetListAsync(t => ids.Contains(t.Id) && t.ClinicBranchId == branchId);
        if (tags.Count != ids.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.MarketingTicket.InvalidTag);
        }

        return tags.Min(t => t.MaxProcessingDays);
    }

    /// <summary>TK000001, TK000002… per branch. Deleted tickets keep their codes.</summary>
    public async Task<string> NextCodeAsync(Guid branchId)
    {
        using (dataFilter.Disable<ISoftDelete>())
        {
            var next = await ticketRepository.CountAsync(t => t.ClinicBranchId == branchId) + 1;
            var code = Format(next);
            while (await ticketRepository.AnyAsync(t => t.ClinicBranchId == branchId && t.Code == code))
            {
                code = Format(++next);
            }

            return code;
        }
    }

    private static string Format(int number) => $"TK{number:D6}";
}
