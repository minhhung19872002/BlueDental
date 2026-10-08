using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PrepaidCards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PrepaidCardId",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_prepaid_card_types",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SalePrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    UsageValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    MaxUses = table.Column<int>(type: "integer", nullable: true),
                    CommissionType = table.Column<short>(type: "smallint", nullable: false),
                    CommissionValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    AllowFamily = table.Column<bool>(type: "boolean", nullable: false),
                    ServiceIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    ServiceGroupIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    IsOnSale = table.Column<bool>(type: "boolean", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_prepaid_card_types", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_prepaid_cards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CardTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OwnerPatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    AllowFamily = table.Column<bool>(type: "boolean", nullable: false),
                    MemberPatientIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    MaxUses = table.Column<int>(type: "integer", nullable: true),
                    ServiceIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    ServiceGroupIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    SalePrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    UsageValue = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SellerStaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    CommissionAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SoldAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    TotalLoaded = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    UsedCount = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
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
                    table.PrimaryKey("PK_bd_prepaid_cards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_prepaid_card_transactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrepaidCardId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PaidAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Method = table.Column<short>(type: "smallint", nullable: true),
                    PaymentAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    OccurredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_prepaid_card_transactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_prepaid_card_transactions_bd_prepaid_cards_PrepaidCardId",
                        column: x => x.PrepaidCardId,
                        principalTable: "bd_prepaid_cards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_PrepaidCardId",
                table: "bd_patient_payments",
                column: "PrepaidCardId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_card_transactions_PatientPaymentId",
                table: "bd_prepaid_card_transactions",
                column: "PatientPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_card_transactions_PrepaidCardId_Sequence",
                table: "bd_prepaid_card_transactions",
                columns: new[] { "PrepaidCardId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_card_types_ClinicBranchId",
                table: "bd_prepaid_card_types",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_cards_CardTypeId",
                table: "bd_prepaid_cards",
                column: "CardTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_cards_ClinicBranchId_SoldAt",
                table: "bd_prepaid_cards",
                columns: new[] { "ClinicBranchId", "SoldAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_cards_Code",
                table: "bd_prepaid_cards",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_prepaid_cards_OwnerPatientId",
                table: "bd_prepaid_cards",
                column: "OwnerPatientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_prepaid_card_transactions");

            migrationBuilder.DropTable(
                name: "bd_prepaid_card_types");

            migrationBuilder.DropTable(
                name: "bd_prepaid_cards");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_payments_PrepaidCardId",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "PrepaidCardId",
                table: "bd_patient_payments");
        }
    }
}
