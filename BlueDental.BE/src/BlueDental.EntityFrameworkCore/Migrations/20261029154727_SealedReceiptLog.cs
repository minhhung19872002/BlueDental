using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-1082: each receipt log line is numbered and sealed to the one before
    /// it, and the table becomes append-only. Lines already there are numbered
    /// by time and stay unsealed; the log API counts them.
    /// </summary>
    public partial class SealedReceiptLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_payment_receipt_logs_PatientPaymentId_At",
                table: "bd_payment_receipt_logs");

            migrationBuilder.AddColumn<string>(
                name: "Seal",
                table: "bd_payment_receipt_logs",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Sequence",
                table: "bd_payment_receipt_logs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE bd_payment_receipt_logs AS l
                SET "Sequence" = n.seq
                FROM (
                    SELECT "Id", row_number() OVER (PARTITION BY "PatientPaymentId" ORDER BY "At", "Id") AS seq
                    FROM bd_payment_receipt_logs
                ) AS n
                WHERE l."Id" = n."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_payment_receipt_logs_PatientPaymentId_Sequence",
                table: "bd_payment_receipt_logs",
                columns: new[] { "PatientPaymentId", "Sequence" },
                unique: true);

            migrationBuilder.Sql("""
                CREATE FUNCTION bd_payment_receipt_logs_append_only() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'bd_payment_receipt_logs is append-only: % refused', TG_OP
                        USING ERRCODE = 'insufficient_privilege';
                END;
                $$;

                CREATE TRIGGER bd_payment_receipt_logs_no_change
                    BEFORE UPDATE OR DELETE ON bd_payment_receipt_logs
                    FOR EACH ROW EXECUTE FUNCTION bd_payment_receipt_logs_append_only();

                CREATE TRIGGER bd_payment_receipt_logs_no_truncate
                    BEFORE TRUNCATE ON bd_payment_receipt_logs
                    FOR EACH STATEMENT EXECUTE FUNCTION bd_payment_receipt_logs_append_only();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER bd_payment_receipt_logs_no_truncate ON bd_payment_receipt_logs;
                DROP TRIGGER bd_payment_receipt_logs_no_change ON bd_payment_receipt_logs;
                DROP FUNCTION bd_payment_receipt_logs_append_only();
                """);

            migrationBuilder.DropIndex(
                name: "IX_bd_payment_receipt_logs_PatientPaymentId_Sequence",
                table: "bd_payment_receipt_logs");

            migrationBuilder.DropColumn(
                name: "Seal",
                table: "bd_payment_receipt_logs");

            migrationBuilder.DropColumn(
                name: "Sequence",
                table: "bd_payment_receipt_logs");

            migrationBuilder.CreateIndex(
                name: "IX_bd_payment_receipt_logs_PatientPaymentId_At",
                table: "bd_payment_receipt_logs",
                columns: new[] { "PatientPaymentId", "At" });
        }
    }
}
