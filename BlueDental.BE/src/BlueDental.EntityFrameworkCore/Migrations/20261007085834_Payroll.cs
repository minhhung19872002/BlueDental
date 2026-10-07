using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class Payroll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_payroll_periods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    StandardWorkDays = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    OvertimeRate = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    FinalizedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinalizedBy = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_bd_payroll_periods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_staff_compensations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Allowance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
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
                    table.PrimaryKey("PK_bd_staff_compensations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_payroll_entries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollPeriodId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Allowance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    WorkedDays = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    LeaveDays = table.Column<decimal>(type: "numeric(5,2)", nullable: false),
                    OvertimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    CommissionAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    WorkDaysOverride = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    Bonus = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    OtherDeduction = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SalaryByWorkDays = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    OvertimePay = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    GrossSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    NetSalary = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_payroll_entries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_payroll_entries_bd_payroll_periods_PayrollPeriodId",
                        column: x => x.PayrollPeriodId,
                        principalTable: "bd_payroll_periods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_payroll_entries_PayrollPeriodId_StaffId",
                table: "bd_payroll_entries",
                columns: new[] { "PayrollPeriodId", "StaffId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_payroll_periods_ClinicBranchId_Year_Month",
                table: "bd_payroll_periods",
                columns: new[] { "ClinicBranchId", "Year", "Month" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_staff_compensations_StaffId",
                table: "bd_staff_compensations",
                column: "StaffId",
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_payroll_entries");

            migrationBuilder.DropTable(
                name: "bd_staff_compensations");

            migrationBuilder.DropTable(
                name: "bd_payroll_periods");
        }
    }
}
