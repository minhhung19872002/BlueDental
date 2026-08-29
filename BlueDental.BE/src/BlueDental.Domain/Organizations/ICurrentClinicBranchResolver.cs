using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BlueDental.Organizations;

public interface ICurrentClinicBranchResolver
{
    Guid? ClinicBranchId { get; }
    Guid GetRequiredClinicBranchId();
    Task<HashSet<Guid>> GetAccessibleBranchIdsAsync();
}
