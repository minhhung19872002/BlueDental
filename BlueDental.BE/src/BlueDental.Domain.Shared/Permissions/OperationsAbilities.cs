using System.Collections.Generic;
using BlueDental.Operations;

namespace BlueDental.Permissions;

/// <summary>
/// The reference names its operations abilities
/// <c>operations&lt;Department&gt;&lt;Section&gt;</c> — 34 subjects in all. One
/// BlueDental endpoint serves every department, so the subject is resolved from
/// the department and section on the request.
/// </summary>
public static class OperationsAbilities
{
    private static readonly Dictionary<OperationsDepartment, string> DepartmentNames = new()
    {
        [OperationsDepartment.Overview] = "Overview",
        [OperationsDepartment.Assistant] = "Assistant",
        [OperationsDepartment.Reception] = "Reception",
        [OperationsDepartment.Cskh] = "Cskh",
        [OperationsDepartment.Marketing] = "Marketing",
        [OperationsDepartment.Security] = "Security",
        [OperationsDepartment.Treatment] = "Treatment",
        [OperationsDepartment.Finance] = "Finance"
    };

    /// <summary>Ability subject for a department's article section.</summary>
    public static string SubjectFor(OperationsDepartment department, OperationsSection section)
    {
        var sectionName = section == OperationsSection.Home ? "Home" : "Process";
        return $"operations{DepartmentNames[department]}{sectionName}";
    }

    /// <summary>Ability subject for a department's task board.</summary>
    public static string TaskSubjectFor(OperationsDepartment department) =>
        $"operations{DepartmentNames[department]}Task";

    public static string PermissionFor(
        OperationsDepartment department,
        OperationsSection section,
        string action) =>
        BlueDentalAbilities.Permission(SubjectFor(department, section), action);

    public static string TaskPermissionFor(OperationsDepartment department, string action) =>
        BlueDentalAbilities.Permission(TaskSubjectFor(department), action);
}
