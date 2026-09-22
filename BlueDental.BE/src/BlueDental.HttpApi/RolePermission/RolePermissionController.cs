using BlueDental.Controllers;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;

namespace BlueDental.RolePermission;

/// <summary>
/// The permission tree the Phân quyền tab draws. Reading it is the same
/// ability as reading a role's grants, so the tab and its data agree on who
/// may look.
/// </summary>
[RemoteService]
[Authorize(BlueDentalAbilityPermissions.RolePermission.Read)]
[Route("api/v1/app/role-permission")]
public sealed class RolePermissionController : BlueDentalController
{
    [HttpGet("permission-tree")]
    public ActionResult<PermissionTreeResponse> GetPermissionTree()
    {
        return new PermissionTreeResponse { Tree = PermissionTreeBuilder.Build() };
    }
}
