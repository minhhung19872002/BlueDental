using BlueDental.Controllers;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.RolePermission;

[RemoteService]
[Authorize]
[Route("api/v1/app/role-permission")]
public sealed class RolePermissionController : BlueDentalController
{
    [HttpGet("permission-tree")]
    public ActionResult<PermissionTreeResponse> GetPermissionTree()
    {
        return new PermissionTreeResponse { Tree = PermissionTreeBuilder.Build() };
    }
}
