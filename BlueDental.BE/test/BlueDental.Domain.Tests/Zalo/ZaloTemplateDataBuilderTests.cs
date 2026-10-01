using System.Collections.Generic;
using BlueDental.Zalo;
using Shouldly;
using Xunit;

namespace BlueDental.Domain.Tests.Zalo;

public class ZaloTemplateDataBuilderTests
{
    private static ZaloTemplateParam Param(string name, bool required = true, int? maxLength = null, bool acceptNull = false) =>
        new(name, required, "STRING", maxLength, null, acceptNull);

    private static readonly Dictionary<string, string?> Known = new()
    {
        [ZaloTemplateDataBuilder.CustomerName] = "Nguyen Test",
        [ZaloTemplateDataBuilder.Phone] = "84912345678",
        [ZaloTemplateDataBuilder.ClinicName] = "BlueDental",
        [ZaloTemplateDataBuilder.Note] = null,
    };

    [Fact]
    public void Fills_parameters_from_known_values_by_direct_name_and_alias()
    {
        var result = ZaloTemplateDataBuilder.Build(
            [Param("customer_name"), Param("ten_khach_hang"), Param("clinic_name")], Known, null);

        result.MissingRequired.ShouldBeEmpty();
        result.Values["customer_name"].ShouldBe("Nguyen Test");
        result.Values["ten_khach_hang"].ShouldBe("Nguyen Test");
        result.Values["clinic_name"].ShouldBe("BlueDental");
    }

    [Fact]
    public void Overrides_win_over_known_values()
    {
        var result = ZaloTemplateDataBuilder.Build(
            [Param("customer_name")], Known, new Dictionary<string, string> { ["customer_name"] = "Override" });

        result.Values["customer_name"].ShouldBe("Override");
    }

    [Fact]
    public void Reports_required_parameters_that_have_no_value()
    {
        var result = ZaloTemplateDataBuilder.Build(
            [Param("order_code"), Param("note"), Param("optional_thing", required: false)], Known, null);

        result.MissingRequired.ShouldBe(["order_code", "note"]);
        result.Values.ContainsKey("optional_thing").ShouldBeFalse();
    }

    [Fact]
    public void A_required_parameter_that_accepts_null_is_not_missing()
    {
        var result = ZaloTemplateDataBuilder.Build([Param("note", acceptNull: true)], Known, null);

        result.MissingRequired.ShouldBeEmpty();
    }

    [Fact]
    public void Clips_values_to_the_parameter_max_length()
    {
        var result = ZaloTemplateDataBuilder.Build([Param("customer_name", maxLength: 6)], Known, null);

        result.Values["customer_name"].ShouldBe("Nguyen");
    }

    [Fact]
    public void A_combined_time_parameter_takes_the_date_and_time_value()
    {
        var known = new Dictionary<string, string?>(Known)
        {
            [ZaloTemplateDataBuilder.DateAndTime] = "09:30 05/10/2026",
        };

        var result = ZaloTemplateDataBuilder.Build([Param("thoi_gian"), Param("schedule_time")], known, null);

        result.MissingRequired.ShouldBeEmpty();
        result.Values["thoi_gian"].ShouldBe("09:30 05/10/2026");
        result.Values["schedule_time"].ShouldBe("09:30 05/10/2026");
    }
}
