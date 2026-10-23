using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Identity;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>"Người gửi" of a send: the staff member's full name, else the login.</summary>
public class MessageSenderNames(IIdentityUserRepository users, IDataFilter dataFilter) : ITransientDependency
{
    public async Task<Dictionary<Guid, string>> LoadAsync(IEnumerable<Guid?> ids)
    {
        var userIds = ids.OfType<Guid>().Distinct().ToList();
        if (userIds.Count == 0)
        {
            return [];
        }

        // Staff removed since still name the sends they made.
        List<IdentityUser> found;
        using (dataFilter.Disable<ISoftDelete>())
        {
            found = await users.GetListByIdsAsync(userIds);
        }

        return found.ToDictionary(u => u.Id, u =>
        {
            var fullName = string.Join(" ", new[] { u.Surname, u.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return string.IsNullOrWhiteSpace(fullName) ? u.UserName : fullName;
        });
    }
}
