using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Cụm 11 mục 9: "Ẩn số điện thoại" (BlueDental.patient.hidePhone) now
    /// masks patient phones. The seed used to grant the three static roles
    /// every permission, this one included, so admins and managers would have
    /// lost the numbers. Take it back from them once; the seed no longer
    /// grants it. Roles the clinic made itself keep whatever it ticked.
    /// </summary>
    public partial class HidePhoneOffStaticRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE FROM "AbpPermissionGrants"
                WHERE "Name" = 'BlueDental.patient.hidePhone'
                  AND "ProviderName" = 'R'
                  AND "ProviderKey" IN ('admin', 'Quản lý phòng khám', 'Quản lý chi nhánh');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Nothing to restore: the grant only ever came from "grant everything".
        }
    }
}
