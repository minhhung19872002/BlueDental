using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

/// <summary>"Tìm người giám hộ đã có hồ sơ" — hồ sơ first, then guardians already on file.</summary>
public interface IGuardianCandidateAppService : IApplicationService
{
    Task<List<GuardianCandidateDto>> GetListAsync(GetGuardianCandidatesInput input);
}
