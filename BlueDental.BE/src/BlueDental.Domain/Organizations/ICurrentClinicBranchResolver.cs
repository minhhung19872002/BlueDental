using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlueDental.Organizations;

public interface ICurrentClinicBranchResolver
{
    /// <summary>The branch named on the request, from the x-branch-id header.</summary>
    Guid? ClinicBranchId { get; }

    /// <summary>
    /// The branch this account belongs to, independent of the request.
    ///
    /// Needed for the first call of a session: the client has not chosen a
    /// branch yet, so no header is sent, and reading only the header told a
    /// branch-scoped account it had no branch at all.
    /// </summary>
    Guid? OwnClinicBranchId { get; }

    Guid GetRequiredClinicBranchId();
    Task<HashSet<Guid>> GetAccessibleBranchIdsAsync();
}
