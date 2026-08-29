using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Microsoft.AspNetCore.Http;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Users;

namespace BlueDental.Application.Organizations;

public class CurrentClinicBranchResolver : ICurrentClinicBranchResolver, ITransientDependency
{
    private readonly ICurrentUser _currentUser;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IRepository<StaffBranchAssignment, Guid> _assignmentRepository;

    private const string HeaderName = "X-Clinic-Branch-Id";

    public CurrentClinicBranchResolver(
        ICurrentUser currentUser,
        IHttpContextAccessor httpContextAccessor,
        IRepository<StaffBranchAssignment, Guid> assignmentRepository)
    {
        _currentUser = currentUser;
        _httpContextAccessor = httpContextAccessor;
        _assignmentRepository = assignmentRepository;
    }

    public Guid? ClinicBranchId
    {
        get
        {
            var headerValue = _httpContextAccessor.HttpContext?.Request.Headers[HeaderName].FirstOrDefault();
            if (!string.IsNullOrEmpty(headerValue) && Guid.TryParse(headerValue, out var headerId))
            {
                return headerId;
            }

            return null;
        }
    }

    public Guid GetRequiredClinicBranchId()
    {
        var id = ClinicBranchId;
        if (id.HasValue) return id.Value;

        var claimValue = _currentUser.FindClaimValue(BlueDentalConsts.UserClinicBranchIdPropertyName);
        if (Guid.TryParse(claimValue, out var claimId)) return claimId;

        throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.BranchNotAssigned);
    }

    public async Task<HashSet<Guid>> GetAccessibleBranchIdsAsync()
    {
        var userId = _currentUser.Id;
        if (!userId.HasValue) return [];

        var assignments = await _assignmentRepository.GetListAsync(a => a.StaffId == userId.Value);
        var branchIds = assignments.Select(a => a.ClinicBranchId).ToHashSet();

        if (branchIds.Count == 0)
        {
            var claimValue = _currentUser.FindClaimValue(BlueDentalConsts.UserClinicBranchIdPropertyName);
            if (Guid.TryParse(claimValue, out var claimId))
                branchIds.Add(claimId);
        }

        return branchIds;
    }
}
