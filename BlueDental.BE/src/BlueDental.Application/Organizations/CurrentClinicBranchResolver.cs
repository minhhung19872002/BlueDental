using System;
using BlueDental.Organizations;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Users;

namespace BlueDental.Application.Organizations;

public class CurrentClinicBranchResolver : ICurrentClinicBranchResolver, ITransientDependency
{
    private readonly ICurrentUser _currentUser;

    public CurrentClinicBranchResolver(ICurrentUser currentUser)
    {
        _currentUser = currentUser;
    }

    public Guid? ClinicBranchId
    {
        get
        {
            var value = _currentUser.FindClaimValue(BlueDentalConsts.UserClinicBranchIdPropertyName);
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public Guid GetRequiredClinicBranchId()
    {
        return ClinicBranchId
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.BranchNotAssigned);
    }
}
