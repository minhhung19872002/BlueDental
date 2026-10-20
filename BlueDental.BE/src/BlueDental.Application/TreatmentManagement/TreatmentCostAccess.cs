using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.Permissions;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// "Tài chính / Kế toán › Chi phí › Xem" (BA P2010). Without it a user sees only
/// the slips they received ("Bác sĩ tiếp nhận" = them) on the patient record's
/// Kế hoạch điều trị tab and in its money cards (see
/// <c>OrgChartScope.VisibleSlips</c>), and the patient list's money columns are
/// masked. The admin role always sees everything, like <c>PatientPhoneMasker</c>.
/// </summary>
public class TreatmentCostAccess(ICurrentUser currentUser, IPermissionChecker permissionChecker) : IScopedDependency
{
    private bool? _seesCosts;

    public virtual async Task<bool> SeesCostsAsync()
    {
        _seesCosts ??= currentUser.IsInRole(BlueDentalAbilitySeedContributor.AdminRoleName)
            || await permissionChecker.IsGrantedAsync(BlueDentalAbilityPermissions.TreatmentCost.Read);
        return _seesCosts.Value;
    }
}
