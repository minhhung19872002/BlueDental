using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-884: an Đơn thuốc mẫu line doses by session (sáng / trưa / chiều / tối)
    /// like a prescription line instead of "ngày uống × mỗi lần". Old lines are
    /// spread with the same rule F-58 used on prescriptions, so every quantity
    /// stays the same: 1 lần → sáng; 2 → sáng, tối; 3 → sáng, trưa, tối; 4 → cả
    /// bốn; beyond 4 the extra doses go to sáng.
    /// </summary>
    public partial class RxTemplateSessionDoses : Migration
    {
        private static readonly string[] Sessions = { "Morning", "Noon", "Afternoon", "Evening" };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var session in Sessions)
            {
                migrationBuilder.AddColumn<decimal>(
                    name: session,
                    table: "bd_prescription_template_lines",
                    type: "numeric(18,2)",
                    nullable: false,
                    defaultValue: 0m);
            }

            migrationBuilder.Sql("""
                UPDATE bd_prescription_template_lines
                SET "Morning" = CASE WHEN "TimesPerDay" >= 1
                                     THEN "AmountPerTime" * (1 + GREATEST("TimesPerDay" - 4, 0))
                                     ELSE 0 END,
                    "Noon" = CASE WHEN "TimesPerDay" >= 3 THEN "AmountPerTime" ELSE 0 END,
                    "Afternoon" = CASE WHEN "TimesPerDay" >= 4 THEN "AmountPerTime" ELSE 0 END,
                    "Evening" = CASE WHEN "TimesPerDay" >= 2 THEN "AmountPerTime" ELSE 0 END;
                """);

            migrationBuilder.DropColumn(name: "TimesPerDay", table: "bd_prescription_template_lines");
            migrationBuilder.DropColumn(name: "AmountPerTime", table: "bd_prescription_template_lines");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TimesPerDay",
                table: "bd_prescription_template_lines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountPerTime",
                table: "bd_prescription_template_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            // Folds the sessions back: times = sessions in use, amount = their average.
            migrationBuilder.Sql("""
                UPDATE bd_prescription_template_lines
                SET "TimesPerDay" = GREATEST(1,
                        ("Morning" > 0)::int + ("Noon" > 0)::int
                        + ("Afternoon" > 0)::int + ("Evening" > 0)::int),
                    "AmountPerTime" = ROUND(("Morning" + "Noon" + "Afternoon" + "Evening")
                        / GREATEST(1,
                            ("Morning" > 0)::int + ("Noon" > 0)::int
                            + ("Afternoon" > 0)::int + ("Evening" > 0)::int), 2);
                """);

            foreach (var session in Sessions)
            {
                migrationBuilder.DropColumn(name: session, table: "bd_prescription_template_lines");
            }
        }
    }
}
