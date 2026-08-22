using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.Account;

public interface IAccountAppService : IApplicationService
{
    Task<CurrentUserDto> GetCurrentUserAsync();
    Task ChangePasswordAsync(ChangePasswordInput input);
}
