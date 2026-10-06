using System;
using Shouldly;
using Xunit;

namespace BlueDental.Catalogs;

/// <summary>
/// Bug list 2026-10-06: names are stored without the spaces around them, so
/// " NHA KHOA TỔNG QUÁT " and "NHA KHOA TỔNG QUÁT" are one name.
/// </summary>
public class CatalogNameTrimTests
{
    [Fact]
    public void A_Group_Name_Is_Stored_Trimmed_On_Create_And_Rename()
    {
        var group = Taxonomy.Create(Guid.NewGuid(), Guid.NewGuid(), TaxonomyGroups.CareService, "  NHA KHOA TỔNG QUÁT  ");
        group.Name.ShouldBe("NHA KHOA TỔNG QUÁT");

        group.Rename("\tNIỀNG RĂNG ");
        group.Name.ShouldBe("NIỀNG RĂNG");
    }

    [Fact]
    public void An_Entry_Name_Is_Stored_Trimmed_On_Create_And_Rename()
    {
        var entry = CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), TaxonomyGroups.CareService, " DUNG-TEST Dịch vụ 1 ");
        entry.Name.ShouldBe("DUNG-TEST Dịch vụ 1");

        entry.Rename("  Cạo vôi  ");
        entry.Name.ShouldBe("Cạo vôi");
    }
}
