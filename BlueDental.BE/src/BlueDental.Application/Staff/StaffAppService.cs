using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

[Authorize]
public class StaffAppService : ApplicationService, IStaffAppService
{
    private readonly IIdentityUserRepository _userRepository;

    public StaffAppService(IIdentityUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffListInput input)
    {
        var users = await _userRepository.GetListAsync(
            sorting: input.Sorting ?? "Name",
            maxResultCount: input.MaxResultCount,
            skipCount: input.SkipCount,
            filter: input.Filter);

        var totalCount = await _userRepository.GetCountAsync(filter: input.Filter);

        var dtos = users.Select(u => new StaffDto
        {
            Id = u.Id,
            UserName = u.UserName,
            Name = u.Name,
            Surname = u.Surname,
            Email = u.Email,
            PhoneNumber = u.PhoneNumber,
            IsActive = u.IsActive,
        }).ToList();

        return new PagedResultDto<StaffDto>(totalCount, dtos);
    }

    public async Task<StaffDto> GetAsync(Guid id)
    {
        var user = await _userRepository.GetAsync(id);
        return new StaffDto
        {
            Id = user.Id,
            UserName = user.UserName,
            Name = user.Name,
            Surname = user.Surname,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            IsActive = user.IsActive,
        };
    }
}
