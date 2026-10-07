using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.PatientManagement;

/// <summary>"Tìm người giám hộ đã có hồ sơ" — hồ sơ and guardians already on file.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/patients")]
public sealed class GuardianCandidateController(IGuardianCandidateAppService service) : BlueDentalController
{
    [HttpGet("guardian-candidates")]
    public Task<List<GuardianCandidateDto>> GetListAsync([FromQuery] GetGuardianCandidatesInput input) =>
        service.GetListAsync(input);
}
