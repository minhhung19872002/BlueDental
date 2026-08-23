using System;

namespace BlueDental.Organizations;

public interface ICurrentClinicBranchResolver
{
    Guid? ClinicBranchId { get; }
    Guid GetRequiredClinicBranchId();
}
