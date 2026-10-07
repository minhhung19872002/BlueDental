using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Data;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Cụm 11 mục 12 — applies the signed-in account's "Quy định giảm giá"
/// (<see cref="DiscountLimit"/>) to a discount it is about to give. The limit
/// is the person typing, not the consultant the line names: those staff
/// fields are free picks. The admin role has no limit.
/// </summary>
public class DiscountLimitGuard(
    ICurrentUser currentUser,
    IdentityUserManager userManager,
    IRepository<CatalogEntry, Guid> catalogRepository) : IScopedDependency
{
    private DiscountLimit? _limit;

    public async Task<DiscountLimit> CurrentLimitAsync()
    {
        if (_limit is not null) return _limit;

        _limit = new DiscountLimit(null, null);
        if (currentUser.Id is not { } userId || currentUser.IsInRole(BlueDentalAbilitySeedContributor.AdminRoleName))
            return _limit;

        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null) return _limit;

        _limit = new DiscountLimit(
            ReadDecimal(user, BlueDentalConsts.UserMaxDiscountPercentPropertyName),
            ReadDecimal(user, BlueDentalConsts.UserMaxDiscountAmountPropertyName));
        return _limit;
    }

    public async Task EnsureAsync(decimal listAmount, decimal discount, DiscountLimit.Measure previous = default) =>
        (await CurrentLimitAsync()).EnsureAllows(listAmount, discount, previous);

    /// <summary>
    /// What one unit of a service sells for before anyone discounts it: the
    /// catalogue's "Giá sau giảm" (its own discount is not the user's), or the
    /// line's own giá gốc when the service has no price on file. Taking the
    /// catalogue's figure keeps a giá gốc sent by the client from hiding a cut.
    /// </summary>
    public async Task<decimal> ReferencePriceAsync(Guid? serviceId, decimal fallback)
    {
        if (serviceId is null) return fallback;

        var query = await catalogRepository.WithDetailsAsync(c => c.ServiceConfig!);
        var entry = query.FirstOrDefault(c => c.Id == serviceId.Value);
        if (entry?.Price is not { } price) return fallback;

        return entry.ServiceConfig?.PriceAfterDiscount(price) ?? price;
    }

    private static decimal? ReadDecimal(IHasExtraProperties user, string name) =>
        user.ExtraProperties.GetOrDefault(name) switch
        {
            null => null,
            decimal value => value,
            IConvertible value => Convert.ToDecimal(value, CultureInfo.InvariantCulture),
            var other => decimal.TryParse(other.ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : null,
        };
}
