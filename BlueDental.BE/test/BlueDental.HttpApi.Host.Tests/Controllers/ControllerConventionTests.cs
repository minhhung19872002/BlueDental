using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Controllers;
using BlueDental.Inventory;
using BlueDental.Labo;
using BlueDental.Notifications;
using BlueDental.Operations;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Reporting;
using BlueDental.RolePermission;
using BlueDental.TreatmentManagement;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.HttpApi.Host.Tests.Controllers;

public class ControllerConventionTests
{
    private static IEnumerable<Type> AllControllers() =>
        typeof(PatientController).Assembly
            .GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(BlueDentalController).IsAssignableFrom(t));

    [Fact]
    public void All_Controllers_Should_Inherit_BlueDentalController()
    {
        var nonCompliant = AllControllers()
            .Where(t => !typeof(BlueDentalController).IsAssignableFrom(t))
            .Select(t => t.Name)
            .ToList();

        nonCompliant.ShouldBeEmpty();
    }

    [Fact]
    public void All_Controllers_Should_Have_RemoteService_Attribute()
    {
        var missing = AllControllers()
            .Where(t => t.GetCustomAttribute<RemoteServiceAttribute>() == null)
            .Select(t => t.Name)
            .ToList();

        missing.ShouldBeEmpty();
    }

    [Fact]
    public void All_Controllers_Should_Have_Route_Attribute()
    {
        var missing = AllControllers()
            .Where(t => t.GetCustomAttribute<RouteAttribute>() == null)
            .Select(t => t.Name)
            .ToList();

        missing.ShouldBeEmpty();
    }

    [Fact]
    public void All_Controllers_Should_Have_Authorize_Attribute()
    {
        var missing = AllControllers()
            .Where(t => t.GetCustomAttribute<AuthorizeAttribute>() == null)
            .Select(t => t.Name)
            .ToList();

        missing.ShouldBeEmpty();
    }

    [Fact]
    public void All_Routes_Should_Start_With_Api_V1_App()
    {
        // What matters is the URL a caller reaches, which is the class template
        // joined to the action's own. A controller whose actions sit on
        // unrelated nouns carries the bare prefix and names the noun per action;
        // that still lands under api/v1/app/.
        var nonCompliant = AllControllers()
            .SelectMany(EffectiveRoutes)
            .Where(x => !x.Route.StartsWith("api/v1/app/"))
            .Select(x => $"{x.Name}: {x.Route}")
            .ToList();

        nonCompliant.ShouldBeEmpty();
    }

    private static IEnumerable<(string Name, string Route)> EffectiveRoutes(Type controller)
    {
        var classTemplate = controller.GetCustomAttribute<RouteAttribute>()?.Template;
        if (classTemplate == null) yield break;

        var actionTemplates = controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(m => m.GetCustomAttributes<HttpMethodAttribute>())
            .Select(a => a.Template)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct()
            .ToList();

        if (actionTemplates.Count == 0)
        {
            yield return (controller.Name, classTemplate);
            yield break;
        }

        foreach (var action in actionTemplates)
            yield return (controller.Name, $"{classTemplate.TrimEnd('/')}/{action!.TrimStart('/')}");
    }

    /// <summary>
    /// The treatment module's controllers are written by hand rather than built
    /// by ABP's convention, so a method added to the app service without a route
    /// beside it answers 405 at runtime and nothing at build time says so. That
    /// is how "Chỉnh sửa" on a receipt first shipped broken.
    /// </summary>
    [Theory]
    [InlineData(typeof(IPatientTreatmentAppService), typeof(PatientTreatmentController))]
    [InlineData(typeof(IPatientPaymentAppService), typeof(PatientPaymentController))]
    public void Hand_Written_Controllers_Should_Route_Every_AppService_Method(
        Type contract, Type controller)
    {
        var routed = controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any())
            .Select(m => m.Name)
            .ToHashSet();

        var missing = contract.GetMethods()
            .Select(m => m.Name)
            .Where(name => !routed.Contains(name))
            .ToList();

        missing.ShouldBeEmpty();
    }

    [Fact]
    public void PatientController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(PatientController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldBe("api/v1/app/patients");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
        typeof(BlueDentalController).IsAssignableFrom(controller).ShouldBeTrue();
    }

    [Fact]
    public void AppointmentController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(AppointmentController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldBe("api/v1/app/appointments");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void InvoiceController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(InvoiceController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldBe("api/v1/app/invoices");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void LaboController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(LaboController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("labo");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void TreatmentPlanController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(TreatmentPlanController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("treatment");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void InventoryItemController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(InventoryItemController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("inventor");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void NotificationController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(NotificationController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("notif");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void ReportController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(ReportController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("report");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void ClinicBranchController_Should_Exist_And_Be_Properly_Configured()
    {
        var controller = typeof(ClinicBranchController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldContain("branch");
        controller.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    /// <summary>
    /// The permission tree feeds the Phân quyền tab; a bare [Authorize] let any
    /// signed-in account read the whole ability catalogue.
    /// </summary>
    [Fact]
    public void RolePermissionController_Should_Require_RolePermission_Read()
    {
        var controller = typeof(RolePermissionController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldBe("api/v1/app/role-permission");
        controller.GetCustomAttribute<AuthorizeAttribute>()!.Policy
            .ShouldBe(BlueDentalAbilityPermissions.RolePermission.Read);
    }

    /// <summary>
    /// The header branch picker is drawn for every signed-in user, so the
    /// route feeding it must not sit behind the Organizations permission; the
    /// service narrows the list to the caller's own branches instead.
    /// </summary>
    [Fact]
    public void ClinicBranchController_Should_Expose_An_Accessible_Route()
    {
        var method = typeof(ClinicBranchController).GetMethod(nameof(ClinicBranchController.GetAccessibleAsync));
        method.ShouldNotBeNull();
        method.GetCustomAttribute<HttpGetAttribute>()!.Template.ShouldBe("accessible");
    }

    /// <summary>
    /// Vận hành reports: one route per screen, and the controller only asks
    /// for a signed-in user because each service method checks its own
    /// reference ability.
    /// </summary>
    [Fact]
    public void OperationReportController_Should_Be_Properly_Configured()
    {
        var controller = typeof(OperationReportController);
        controller.GetCustomAttribute<RouteAttribute>()!.Template.ShouldBe("api/v1/app/operations/reports");
        controller.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBeNull();

        var routes = controller
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Select(m => m.GetCustomAttribute<HttpGetAttribute>()?.Template)
            .Where(t => t is not null)
            .ToList();

        routes.ShouldBe(
            ["work-log", "untreated-diagnoses", "consultant-summary", "invoices", "service-completion", "sales-access"],
            ignoreOrder: true);
    }
}
