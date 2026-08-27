using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// A voucher stops being one material.
    ///
    /// The reference issues a whole selection on one voucher: you tick what you
    /// need in Vật tư phòng khám, name the department, and everything leaves
    /// under one code. Its allocation is
    /// <c>{ code, departmentId, items: [{ supplyId, name, qty, confirmedQty }] }</c>.
    /// BlueDental carried a single InventoryItemId on the voucher itself, which
    /// could not express that at all.
    ///
    /// Existing vouchers are moved across before the old columns go, so nothing
    /// already issued is lost: each becomes a voucher with exactly one line, its
    /// quantity and its confirmed remainder intact.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260827100000_AllocationCarriesManyMaterials")]
    public partial class AllocationCarriesManyMaterials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_material_allocation_items",
                columns: table => new
                {
                    Id = table.Column<System.Guid>(type: "uuid", nullable: false),
                    MaterialAllocationId = table.Column<System.Guid>(type: "uuid", nullable: false),
                    InventoryItemId = table.Column<System.Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    ConfirmedQuantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_material_allocation_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_material_allocation_items_bd_material_allocations_Materi~",
                        column: x => x.MaterialAllocationId,
                        principalTable: "bd_material_allocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_material_allocation_items_MaterialAllocationId",
                table: "bd_material_allocation_items",
                column: "MaterialAllocationId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_material_allocation_items_InventoryItemId",
                table: "bd_material_allocation_items",
                column: "InventoryItemId");

            // Carry every existing voucher over as a single-line voucher. The
            // name is taken from the material as it stands now — the old schema
            // never kept the name at the time, so this is the best that exists.
            migrationBuilder.Sql(@"
                INSERT INTO bd_material_allocation_items
                    (""Id"", ""MaterialAllocationId"", ""InventoryItemId"", ""Name"", ""Quantity"", ""ConfirmedQuantity"")
                SELECT
                    gen_random_uuid(),
                    a.""Id"",
                    a.""InventoryItemId"",
                    COALESCE(i.""Name"", 'Vật tư'),
                    a.""AllocatedQuantity"",
                    a.""ConfirmedRemaining""
                FROM bd_material_allocations a
                LEFT JOIN bd_inventory_items i ON i.""Id"" = a.""InventoryItemId"";
            ");

            migrationBuilder.DropColumn(name: "InventoryItemId", table: "bd_material_allocations");
            migrationBuilder.DropColumn(name: "AllocatedQuantity", table: "bd_material_allocations");
            migrationBuilder.DropColumn(name: "ConfirmedRemaining", table: "bd_material_allocations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<System.Guid>(
                name: "InventoryItemId",
                table: "bd_material_allocations",
                type: "uuid",
                nullable: false,
                defaultValue: System.Guid.Empty);

            migrationBuilder.AddColumn<decimal>(
                name: "AllocatedQuantity",
                table: "bd_material_allocations",
                type: "numeric(18,3)",
                precision: 18,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ConfirmedRemaining",
                table: "bd_material_allocations",
                type: "numeric(18,3)",
                precision: 18,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            // Only the first line of each voucher can come back; a voucher that
            // carried several materials cannot be expressed by the old shape.
            migrationBuilder.Sql(@"
                UPDATE bd_material_allocations a
                SET ""InventoryItemId"" = f.""InventoryItemId"",
                    ""AllocatedQuantity"" = f.""Quantity"",
                    ""ConfirmedRemaining"" = COALESCE(f.""ConfirmedQuantity"", 0)
                FROM (
                    SELECT DISTINCT ON (""MaterialAllocationId"")
                        ""MaterialAllocationId"", ""InventoryItemId"", ""Quantity"", ""ConfirmedQuantity""
                    FROM bd_material_allocation_items
                    ORDER BY ""MaterialAllocationId"", ""Id""
                ) f
                WHERE f.""MaterialAllocationId"" = a.""Id"";
            ");

            migrationBuilder.DropTable(name: "bd_material_allocation_items");
        }
    }
}
