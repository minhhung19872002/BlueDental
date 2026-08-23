using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_cashflow_categories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    AppliesToTransfers = table.Column<bool>(type: "boolean", nullable: false),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_cashflow_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_cashflow_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionType = table.Column<short>(type: "smallint", nullable: false),
                    FromHolding = table.Column<short>(type: "smallint", nullable: true),
                    ToHolding = table.Column<short>(type: "smallint", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedByStaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
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
                    table.PrimaryKey("PK_bd_cashflow_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_sales_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Channel = table.Column<short>(type: "smallint", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    EntryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ApprovalStatus = table.Column<short>(type: "smallint", nullable: false),
                    ApprovedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_sales_entries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_cashflow_categories_ClinicBranchId_AppliesToTransfers_Ty~",
                table: "bd_cashflow_categories",
                columns: new[] { "ClinicBranchId", "AppliesToTransfers", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_cashflow_entries_ClinicBranchId_EntryDate",
                table: "bd_cashflow_entries",
                columns: new[] { "ClinicBranchId", "EntryDate" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_cashflow_entries_ClinicBranchId_TransactionType",
                table: "bd_cashflow_entries",
                columns: new[] { "ClinicBranchId", "TransactionType" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_sales_entries_ClinicBranchId_ApprovalStatus",
                table: "bd_sales_entries",
                columns: new[] { "ClinicBranchId", "ApprovalStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_sales_entries_ClinicBranchId_EntryDate_Type",
                table: "bd_sales_entries",
                columns: new[] { "ClinicBranchId", "EntryDate", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_sales_entries_Code",
                table: "bd_sales_entries",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_cashflow_categories");

            migrationBuilder.DropTable(
                name: "bd_cashflow_entries");

            migrationBuilder.DropTable(
                name: "bd_sales_entries");
        }
    }
}
