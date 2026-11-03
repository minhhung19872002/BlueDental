using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class LaboWorkflowP291003 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_LaboOrderId",
                table: "bd_patient_images");

            migrationBuilder.AddColumn<int>(
                name: "LaboRoundNo",
                table: "bd_patient_images",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_labo_order_rounds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LaboOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoundNo = table.Column<int>(type: "integer", nullable: false),
                    ReceivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ReceivedQuantity = table.Column<int>(type: "integer", nullable: false),
                    ReceiverId = table.Column<Guid>(type: "uuid", nullable: true),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Outcome = table.Column<short>(type: "smallint", nullable: false),
                    ReturnDescription = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReturnedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RedeliveryDueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ToothResults = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_labo_order_rounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_labo_order_rounds_bd_labo_orders_LaboOrderId",
                        column: x => x.LaboOrderId,
                        principalTable: "bd_labo_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_labo_order_teeth",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LaboOrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothNumber = table.Column<int>(type: "integer", nullable: false),
                    CheckResult = table.Column<short>(type: "smallint", nullable: false),
                    DefectNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PassedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WarrantyCardCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    ManufacturerSerial = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    WarrantyStartDate = table.Column<DateOnly>(type: "date", nullable: true),
                    WarrantyMonths = table.Column<int>(type: "integer", nullable: true),
                    WarrantyEndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    WarrantyConditions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    WarrantyActivatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    WarrantyActivatedById = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_labo_order_teeth", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_labo_order_teeth_bd_labo_orders_LaboOrderId",
                        column: x => x.LaboOrderId,
                        principalTable: "bd_labo_orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // P2910_03 (owner, 2026-10-30): old orders take the new statuses —
            // Đơn hàng mới → Nháp; Đã gửi / Đang xử lý / Giao trễ → Đã gửi Labo
            // (Giao trễ is now read from the date); Đã nhận hàng → Chờ kiểm tra;
            // Hoàn thành stays; Đã huỷ / Đã thay thế → Đã hủy.
            migrationBuilder.Sql(@"
UPDATE bd_labo_orders SET ""Status"" = CASE ""Status""
    WHEN 1 THEN 1
    WHEN 2 THEN 2 WHEN 3 THEN 2 WHEN 7 THEN 2
    WHEN 4 THEN 3
    WHEN 5 THEN 5
    WHEN 6 THEN 6 WHEN 8 THEN 6
    ELSE ""Status"" END;");

            // The teeth the free-text Răng column named, one row each; anything
            // that is not an FDI number is left in the text only.
            migrationBuilder.Sql(@"
INSERT INTO bd_labo_order_teeth (""Id"", ""LaboOrderId"", ""ToothNumber"", ""CheckResult"")
SELECT gen_random_uuid(), t.""Id"", t.tooth, 0
FROM (
    SELECT DISTINCT o.""Id"", part::int AS tooth
    FROM bd_labo_orders o
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(o.""ToothNumbers"", ''), '[^0-9]+') AS part
    WHERE part ~ '^[1-8][0-9]$'
) t
WHERE (t.tooth / 10 BETWEEN 1 AND 4 AND t.tooth % 10 BETWEEN 1 AND 8)
   OR (t.tooth / 10 BETWEEN 5 AND 8 AND t.tooth % 10 BETWEEN 1 AND 5);");

            // A finished order passed QC on the day it came back.
            migrationBuilder.Sql(@"
UPDATE bd_labo_order_teeth t
SET ""CheckResult"" = 1,
    ""PassedAt"" = coalesce(o.""ReceivedAt"", o.""LastModificationTime"", o.""CreationTime"")
FROM bd_labo_orders o
WHERE o.""Id"" = t.""LaboOrderId"" AND o.""Status"" = 5;");

            // An order received but not finished waits for its first check.
            migrationBuilder.Sql(@"
INSERT INTO bd_labo_order_rounds (""Id"", ""LaboOrderId"", ""RoundNo"", ""ReceivedAt"", ""ReceivedQuantity"", ""Outcome"")
SELECT gen_random_uuid(), o.""Id"", 1,
       coalesce(o.""ReceivedAt"", o.""LastModificationTime"", o.""CreationTime""),
       greatest(o.""Quantity"", 1), 0
FROM bd_labo_orders o
WHERE o.""Status"" = 3;");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo",
                table: "bd_patient_images",
                columns: new[] { "LaboOrderId", "LaboRoundNo" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_TreatmentServiceId",
                table: "bd_labo_orders",
                column: "TreatmentServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_order_rounds_LaboOrderId_RoundNo",
                table: "bd_labo_order_rounds",
                columns: new[] { "LaboOrderId", "RoundNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_order_teeth_LaboOrderId_ToothNumber",
                table: "bd_labo_order_teeth",
                columns: new[] { "LaboOrderId", "ToothNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_labo_order_rounds");

            migrationBuilder.DropTable(
                name: "bd_labo_order_teeth");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo",
                table: "bd_patient_images");

            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_TreatmentServiceId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "LaboRoundNo",
                table: "bd_patient_images");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_LaboOrderId",
                table: "bd_patient_images",
                column: "LaboOrderId");
        }
    }
}
