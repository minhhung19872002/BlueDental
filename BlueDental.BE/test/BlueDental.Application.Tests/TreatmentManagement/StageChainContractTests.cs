using System;
using System.ComponentModel.DataAnnotations;
using System.Reflection;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.TreatmentManagement;

/// <summary>
/// The contract behind "Tiếp tục công đoạn" / "Tiếp tục bảo hành" and the plan
/// table's "Chỉnh sửa", as measured on staging 2026-09-24.
/// </summary>
public class StageChainContractTests
{
    [Fact]
    public void Continue_should_take_the_next_visit_in_its_body()
    {
        var method = typeof(ITreatmentStageAppService).GetMethod("ContinueAsync");
        method.ShouldNotBeNull();
        method!.GetParameters()[1].ParameterType.ShouldBe(typeof(ContinueTreatmentStageDto));
    }

    [Fact]
    public void Continue_should_not_carry_teeth()
    {
        // The chain's teeth are its own; the reference locks them on the form.
        typeof(ContinueTreatmentStageDto).GetProperty("Teeth").ShouldBeNull();
    }

    [Fact]
    public void Continue_should_require_the_doctor_and_the_note()
    {
        typeof(ContinueTreatmentStageDto).GetProperty("StaffId")!
            .GetCustomAttribute<RequiredAttribute>().ShouldNotBeNull();
        var note = typeof(ContinueTreatmentStageDto).GetProperty("Note")!;
        note.GetCustomAttribute<RequiredAttribute>().ShouldNotBeNull();
        note.GetCustomAttribute<StringLengthAttribute>()!.MaximumLength.ShouldBe(1000);
    }

    [Fact]
    public void Continue_should_be_gated_by_the_continue_ability()
    {
        typeof(TreatmentStageAppService)
            .GetMethod("ContinueAsync")!
            .GetCustomAttribute<AuthorizeAttribute>()!
            .Policy.ShouldBe(BlueDentalAbilityPermissions.TreatmentStage.Continue);
    }

    [Fact]
    public void A_stage_should_say_whether_it_was_continued_and_from_what()
    {
        typeof(TreatmentStageDto).GetProperty("IsSuperseded")!.PropertyType.ShouldBe(typeof(bool));
        typeof(TreatmentStageDto).GetProperty("ContinuedFromId")!.PropertyType.ShouldBe(typeof(Guid?));
        typeof(TreatmentStageDto).GetProperty("WarrantyRootStageId")!.PropertyType.ShouldBe(typeof(Guid?));
    }

    [Fact]
    public void A_warranty_should_name_the_stage_it_is_raised_from()
    {
        typeof(CreateTreatmentStageDto).GetProperty("WarrantySourceStageId")!
            .PropertyType.ShouldBe(typeof(Guid?));
    }

    [Fact]
    public void A_saved_line_should_be_editable_behind_the_consultation_update_ability()
    {
        typeof(IPatientTreatmentAppService).GetMethod("UpdateServiceAsync").ShouldNotBeNull();
        typeof(PatientTreatmentAppService)
            .GetMethod("UpdateServiceAsync")!
            .GetCustomAttribute<AuthorizeAttribute>()!
            .Policy.ShouldBe(BlueDentalAbilityPermissions.TreatmentConsultation.Update);
    }

    [Fact]
    public void Editing_a_line_should_not_change_its_service_or_status()
    {
        typeof(UpdateTreatmentServiceDto).GetProperty("ServiceId").ShouldBeNull();
        typeof(UpdateTreatmentServiceDto).GetProperty("Status").ShouldBeNull();
    }
}
