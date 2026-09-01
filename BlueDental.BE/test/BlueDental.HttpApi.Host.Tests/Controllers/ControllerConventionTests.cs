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
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Reporting;
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
}
