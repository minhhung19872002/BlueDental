using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BlueDental.RolePermission;

public sealed class PermissionTreeResponse
{
    public List<PermissionTreeNode> Tree { get; set; } = [];
}

public sealed class PermissionTreeNode
{
    public string Type { get; set; } = "";
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<PermissionTreeNode>? Children { get; set; }
}
