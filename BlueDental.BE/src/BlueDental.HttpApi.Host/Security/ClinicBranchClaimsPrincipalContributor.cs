using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Identity;
using Volo.Abp.Security.Claims;

namespace BlueDental.Security;

public class ClinicBranchClaimsPrincipalContributor : IAbpClaimsPrincipalContributor, ITransientDependency
{
    private readonly IdentityUserManager _userManager;

    public ClinicBranchClaimsPrincipalContributor(IdentityUserManager userManager)
    {
        _userManager = userManager;
    }

    public async Task ContributeAsync(AbpClaimsPrincipalContributorContext context)
    {
        var identity = context.ClaimsPrincipal?.Identities.FirstOrDefault();
        if (identity == null) return;

        var userId = identity.FindFirst(AbpClaimTypes.UserId)?.Value;
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var uid)) return;

        var user = await _userManager.FindByIdAsync(uid.ToString());
        if (user == null) return;

        var branchId = user.ExtraProperties.GetOrDefault(BlueDentalConsts.UserClinicBranchIdPropertyName);
        if (branchId != null)
        {
            identity.AddClaim(new Claim(BlueDentalConsts.UserClinicBranchIdPropertyName, branchId.ToString()!));
        }
    }
}
