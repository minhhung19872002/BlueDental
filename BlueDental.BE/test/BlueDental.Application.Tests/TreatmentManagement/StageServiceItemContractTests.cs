using System;
using System.Linq;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

/// <summary>
/// "Danh sách công đoạn" — the contract behind the checkboxes on the công đoạn
/// form and in the treatment history row.
/// </summary>
public class StageServiceItemContractTests
{
    [Fact]
    public void The_stage_should_expose_the_steps_it_covers()
    {
        typeof(TreatmentStageDto).GetProperty("ServiceItems").ShouldNotBeNull();
    }

    [Fact]
    public void Creating_a_stage_should_take_the_steps_ticked_on_the_form()
    {
        typeof(CreateTreatmentStageDto).GetProperty("ServiceItemIds").ShouldNotBeNull();
    }

    [Fact]
    public void A_step_should_be_named_from_the_catalog_rather_than_copied()
    {
        // The row shows a name, but the create call only sends ids — a rename in
        // Danh mục has to show through, so nothing may carry its own copy.
        typeof(StageServiceItemDto).GetProperty("Name").ShouldNotBeNull();
        typeof(StageServiceItemStateDto).GetProperty("Name").ShouldBeNull();
        typeof(CreateTreatmentStageDto)
            .GetProperty("ServiceItemIds")!
            .PropertyType.GetGenericArguments()
            .Single()
            .ShouldBe(typeof(Guid));
    }

    [Fact]
    public void A_step_should_report_its_tick_with_who_and_when()
    {
        typeof(StageServiceItemDto).GetProperty("IsCompleted").ShouldNotBeNull();
        typeof(StageServiceItemDto).GetProperty("CompletedAt").ShouldNotBeNull();
        typeof(StageServiceItemDto).GetProperty("StaffId").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateServiceItemsAsync_should_exist_on_the_interface()
    {
        typeof(ITreatmentStageAppService).GetMethod("UpdateServiceItemsAsync").ShouldNotBeNull();
    }

    [Fact]
    public void UpdateServiceItemsAsync_should_be_gated_by_the_stage_update_ability()
    {
        // The reference has no ability of its own for the tick, so it rides on
        // the one for editing a công đoạn.
        typeof(TreatmentStageAppService)
            .GetMethod("UpdateServiceItemsAsync")
            .ShouldNotBeNull()
            .GetCustomAttribute<AuthorizeAttribute>()
            .ShouldNotBeNull()
            .Policy.ShouldBe(BlueDentalAbilityPermissions.TreatmentStage.Update);
    }

    [Fact]
    public void The_update_should_take_the_whole_list_rather_than_one_step()
    {
        // One call is the whole picture: a step left out is unticked, which is
        // what lets the same endpoint tick and untick.
        typeof(UpdateStageServiceItemsDto).GetProperty("Items").ShouldNotBeNull();
        typeof(UpdateStageServiceItemsDto).GetProperty("CatalogServiceStageId").ShouldBeNull();
        typeof(UpdateStageServiceItemsDto).GetProperty("IsCompleted").ShouldBeNull();
    }

    [Fact]
    public void A_service_line_should_carry_the_steps_the_service_declares()
    {
        // The form lists the boxes, so the line has to hand it the names.
        typeof(TreatmentServiceDto).GetProperty("ServiceSteps").ShouldNotBeNull();
        typeof(ServiceStepDto).GetProperty("Id").ShouldNotBeNull();
        typeof(ServiceStepDto).GetProperty("Name").ShouldNotBeNull();
    }
}
