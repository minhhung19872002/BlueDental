using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Bug list item 36: the service, chẩn đoán/tư vấn and simple catalog
    /// dialogs sent no "isActive" once the "Đang hoạt động / Đã xoá" pair became
    /// a soft delete, so every Lưu switched the entry off and the pickers lost
    /// it. No screen switches an entry off on purpose, so every live entry that
    /// is off got there that way and is switched back on. Deleted entries are
    /// left as they are; bringing one back through its dialog turns it on.
    ///
    /// Data only: the model is unchanged, so the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261012090000_ReactivateCatalogEntries")]
    public partial class ReactivateCatalogEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE bd_catalog_entries
                SET "IsActive" = true
                WHERE "IsActive" = false AND "IsDeleted" = false;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Which entries were off is not kept, and none should be.
        }
    }
}
