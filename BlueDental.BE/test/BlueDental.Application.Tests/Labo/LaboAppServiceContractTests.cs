using System.Reflection;
using BlueDental.Labo;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;
using Xunit;

namespace BlueDental.Application.Tests.Labo;

public class LaboAppServiceContractTests
{
    private readonly Type _serviceType = typeof(LaboAppService);
    private readonly Type _interfaceType = typeof(ILaboAppService);

    [Fact]
    public void LaboAppService_Should_Implement_ILaboAppService()
    {
        _interfaceType.IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void LaboAppService_Should_Inherit_ApplicationService()
    {
        typeof(ApplicationService).IsAssignableFrom(_serviceType).ShouldBeTrue();
    }

    [Fact]
    public void LaboAppService_Should_Require_Authorization_At_Class_Level()
    {
        _serviceType.GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void GetListAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("GetListAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateAsync_Should_Exist_On_Interface()
    {
        _interfaceType.GetMethod("CreateAsync").ShouldNotBeNull();
    }

    [Fact]
    public void CreateLaboOrderDto_Should_Have_Required_Fields()
    {
        var dto = typeof(CreateLaboOrderDto);
        dto.GetProperty("PatientId").ShouldNotBeNull();
        dto.GetProperty("BranchId").ShouldNotBeNull();
        dto.GetProperty("SupplierId").ShouldNotBeNull();
    }

    /// <summary>P2910_03 dropped Làm tiếp công đoạn / Bảo hành child orders.</summary>
    [Fact]
    public void CreateLaboOrderDto_Should_No_Longer_Raise_Child_Orders()
    {
        typeof(CreateLaboOrderDto).GetProperty("ParentOrderId").ShouldBeNull();
        typeof(CreateLaboOrderDto).GetProperty("Kind").ShouldBeNull();
    }

    [Theory]
    [InlineData("UpdateAsync")]
    [InlineData("CancelAsync")]
    [InlineData("DeleteAsync")]
    [InlineData("ReceiveAsync")]
    [InlineData("CheckAsync")]
    [InlineData("ActivateWarrantyAsync")]
    public void Workflow_Action_Should_Exist_On_Interface(string name)
    {
        _interfaceType.GetMethod(name).ShouldNotBeNull();
    }

    [Fact]
    public void Old_Status_And_Detail_Actions_Should_Be_Gone()
    {
        _interfaceType.GetMethod("SaveDetailAsync").ShouldBeNull();
        _interfaceType.GetMethod("ChangeStatusAsync").ShouldBeNull();
    }

    [Fact]
    public void SaveLaboOrderDto_Should_Carry_The_Submit_Flag_And_Teeth()
    {
        var dto = typeof(SaveLaboOrderDto);
        dto.GetProperty("Submit")!.PropertyType.ShouldBe(typeof(bool));
        dto.GetProperty("Teeth")!.PropertyType.ShouldBe(typeof(List<int>));
    }

    [Fact]
    public void Labo_Due_Should_Be_A_Stamp_Not_A_Day()
    {
        // Ngày nhận dự kiến and Giờ nhận travel as one stamp, on every contract.
        foreach (var dto in new[] { typeof(LaboOrderDto), typeof(CreateLaboOrderDto), typeof(UpdateLaboOrderDto) })
        {
            dto.GetProperty("DueDate").ShouldBeNull(dto.Name);
            dto.GetProperty("DueAt")!.PropertyType.ShouldBe(typeof(DateTimeOffset?), dto.Name);
        }
    }

    [Fact]
    public void CreateLaboOrderDto_Should_Carry_The_Dialog_Pictures()
    {
        typeof(CreateLaboOrderDto).GetProperty("Pictures")!
            .PropertyType.ShouldBe(typeof(List<IRemoteStreamContent>));
    }

    [Fact]
    public void LaboOrderDto_Should_Expose_What_The_Workflow_Dialog_Reads()
    {
        var dto = typeof(LaboOrderDto);
        foreach (var name in new[]
                 {
                     "ParentOrderId", "TreatmentPlanId", "TreatmentPlanCode",
                     "TreatmentPlanDentistName", "TreatmentServiceName", "TreatmentServiceStatus",
                     "BiteName", "FinishLineName", "RhythmName", "LaboServiceName",
                     "Teeth", "Rounds", "ReturnCount", "IsWarrantyExpired"
                 })
        {
            dto.GetProperty(name).ShouldNotBeNull(name);
        }
    }
}
