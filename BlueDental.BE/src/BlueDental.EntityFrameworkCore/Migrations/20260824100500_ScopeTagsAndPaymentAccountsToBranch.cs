using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Danh mục / Thẻ hồ sơ and Danh mục / Phương thức thanh toán.
    ///
    /// Tags gain the clinic branch every other piece of clinic data carries, and
    /// the placeholder <c>bd_payment_methods</c> lookup — never read by any
    /// screen — is replaced by the MoMo/bank accounts the reference actually
    /// manages.
    ///
    /// Hand-written rather than scaffolded: the model snapshot in this repository
    /// has drifted from the database for unrelated entities (prescriptions,
    /// treatment plans), so a scaffolded migration would have carried their
    /// phantom differences along with these changes.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260824100500_ScopeTagsAndPaymentAccountsToBranch")]
    public partial class ScopeTagsAndPaymentAccountsToBranch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_payment_methods");

            // Existing rows predate branch scoping; there is exactly one branch
            // in every deployment so far, so they are left pointing at the empty
            // GUID and re-created rather than silently attached to a branch.
            migrationBuilder.Sql(@"DELETE FROM ""bd_patient_tags"";");

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_patient_tags",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AlterColumn<string>(
                name: "Color",
                table: "bd_patient_tags",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "#3B82F6",
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_tags_ClinicBranchId",
                table: "bd_patient_tags",
                column: "ClinicBranchId");

            migrationBuilder.CreateTable(
                name: "bd_payment_accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    HolderName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    BankName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_payment_accounts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_payment_accounts_ClinicBranchId_Kind",
                table: "bd_payment_accounts",
                columns: new[] { "ClinicBranchId", "Kind" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_payment_accounts");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_tags_ClinicBranchId",
                table: "bd_patient_tags");

            migrationBuilder.DropColumn(
                name: "ClinicBranchId",
                table: "bd_patient_tags");

            migrationBuilder.AlterColumn<string>(
                name: "Color",
                table: "bd_patient_tags",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.CreateTable(
                name: "bd_payment_methods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_payment_methods", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_payment_methods_Code",
                table: "bd_payment_methods",
                column: "Code",
                unique: true);
        }
    }
}
