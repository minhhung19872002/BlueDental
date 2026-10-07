using System.Linq;
using System.Threading.Tasks;
using BlueDental.Permissions;
using Volo.Abp.Caching;
using Volo.Abp.DependencyInjection;
using Volo.Abp.PermissionManagement;

namespace BlueDental.Security;

/// <summary>
/// Migration HidePhoneOffStaticRoles takes "Ẩn số điện thoại" back from the
/// static roles with plain SQL, from the migrator, which does not share the
/// API's Redis cache. ABP caches each grant with a sliding expiry that every
/// current-user call renews, so the old "granted" would outlive the row.
/// Dropping those three cache entries at start-up makes the API read the
/// database again; with nothing stale it is a no-op.
/// </summary>
public class HidePhoneCacheReset(IDistributedCache<PermissionGrantCacheItem> cache) : ITransientDependency
{
    private static readonly string[] StaticRoles = ["admin", "Quản lý phòng khám", "Quản lý chi nhánh"];

    public Task ResetAsync() => cache.RemoveManyAsync(StaticRoles
        .Select(role => PermissionGrantCacheItem.CalculateCacheKey(
            BlueDentalAbilityPermissions.Patient.HidePhone, "R", role)));
}
