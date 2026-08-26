using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class RefactorVoucherSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_vouchers_Status_ValidFrom_ValidTo",
                table: "bd_vouchers");

            migrationBuilder.DropColumn(
                name: "CustomerTarget",
                table: "bd_vouchers");

            migrationBuilder.RenameColumn(
                name: "MinOrderAmount",
                table: "bd_vouchers",
                newName: "MinOrderValue");

            migrationBuilder.AddColumn<string>(
                name: "Prefix",
                table: "bd_vouchers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "ScopeTarget",
                table: "bd_vouchers",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.AddColumn<Guid[]>(
                name: "TargetIds",
                table: "bd_vouchers",
                type: "uuid[]",
                nullable: false,
                defaultValueSql: "'{}'::uuid[]");

            migrationBuilder.AddColumn<string[]>(
                name: "CustomerTargets",
                table: "bd_vouchers",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY['new','returning']::text[]");

            migrationBuilder.AddColumn<bool>(
                name: "IsPublished",
                table: "bd_vouchers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "bd_vouchers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsExclusive",
                table: "bd_vouchers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PerCustomerLimit",
                table: "bd_vouchers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDaysOfWeekLimited",
                table: "bd_vouchers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int[]>(
                name: "DaysOfWeek",
                table: "bd_vouchers",
                type: "integer[]",
                nullable: false,
                defaultValueSql: "'{}'::integer[]");

            migrationBuilder.AddColumn<bool>(
                name: "DisplayOnNfcDental",
                table: "bd_vouchers",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.Sql(@"
                UPDATE bd_vouchers SET
                    ""IsPublished"" = CASE WHEN ""Status"" = 2 THEN true ELSE false END,
                    ""PublishedAt"" = CASE WHEN ""Status"" = 2 THEN NOW() ELSE NULL END,
                    ""Status"" = CASE
                        WHEN ""Status"" = 4 THEN 2
                        ELSE 1
                    END;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_bd_vouchers_IsPublished_Status_ValidFrom_ValidTo",
                table: "bd_vouchers",
                columns: new[] { "IsPublished", "Status", "ValidFrom", "ValidTo" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_vouchers_IsPublished_Status_ValidFrom_ValidTo",
                table: "bd_vouchers");

            migrationBuilder.DropColumn(name: "Prefix", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "ScopeTarget", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "TargetIds", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "CustomerTargets", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "IsPublished", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "PublishedAt", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "IsExclusive", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "PerCustomerLimit", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "IsDaysOfWeekLimited", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "DaysOfWeek", table: "bd_vouchers");
            migrationBuilder.DropColumn(name: "DisplayOnNfcDental", table: "bd_vouchers");

            migrationBuilder.RenameColumn(
                name: "MinOrderValue",
                table: "bd_vouchers",
                newName: "MinOrderAmount");

            migrationBuilder.AddColumn<short>(
                name: "CustomerTarget",
                table: "bd_vouchers",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.CreateIndex(
                name: "IX_bd_vouchers_Status_ValidFrom_ValidTo",
                table: "bd_vouchers",
                columns: new[] { "Status", "ValidFrom", "ValidTo" });
        }
    }
}
