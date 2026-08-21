using BlueDental.Localization;
using Volo.Abp.AspNetCore.Mvc;

namespace BlueDental.Controllers;

/// <summary>
/// Base controller for all BlueDental API controllers.
/// Inherits ABP conventions (localization, current user injection, etc.).
/// </summary>
public abstract class BlueDentalController : AbpControllerBase
{
    protected BlueDentalController()
    {
        LocalizationResource = typeof(BlueDentalResource);
    }
}
