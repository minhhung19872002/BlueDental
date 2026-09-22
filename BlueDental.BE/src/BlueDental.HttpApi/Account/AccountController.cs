using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.Account;

/// <summary>
/// The signed-in user's own profile and password. Every route only asks for
/// a signed-in user; the service narrows what it returns to the caller.
/// </summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/account")]
public sealed class AccountController(IAccountAppService service) : BlueDentalController
{
    [HttpGet("current-user")]
    public Task<CurrentUserDto> GetCurrentUserAsync() => service.GetCurrentUserAsync();

    [HttpPost("change-password")]
    public Task ChangePasswordAsync([FromBody] ChangePasswordInput input) => service.ChangePasswordAsync(input);
}
