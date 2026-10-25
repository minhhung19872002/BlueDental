using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-1029: the OA's automatic welcome card ("[Tin tự động của OA]") was
    /// counted as an answer, so a customer greeted by it showed "Đã chăm sóc"
    /// before anyone wrote back. It no longer counts; this counts the stored
    /// conversations again the way the app now does: the last answer is the
    /// newest OA message that is neither the card asking for the phone (Kind 8)
    /// nor an automatic one (Kind 9), and a customer message after it — or no
    /// answer at all — is "Chưa trả lời" (0).
    ///
    /// Data only: the model is unchanged, so the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261025090000_ZaloAutomaticMessageNoAnswer")]
    public partial class ZaloAutomaticMessageNoAnswer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                WITH answered AS (
                    SELECT c."Id",
                           (SELECT max(m."SentAt")
                            FROM bd_zalo_chat_messages m
                            WHERE m."ConversationId" = c."Id"
                              AND m."Direction" = 1
                              AND m."Kind" NOT IN (8, 9)) AS "LastReplyAt"
                    FROM bd_zalo_conversations c
                )
                UPDATE bd_zalo_conversations c
                SET "LastReplyAt" = a."LastReplyAt",
                    "Status" = CASE
                        WHEN c."LastCustomerMessageAt" IS NOT NULL
                             AND (a."LastReplyAt" IS NULL OR c."LastCustomerMessageAt" > a."LastReplyAt")
                        THEN 0 ELSE 1 END,
                    "LastModificationTime" = now(),
                    "ConcurrencyStamp" = replace(gen_random_uuid()::text, '-', '')
                FROM answered a
                WHERE a."Id" = c."Id"
                  AND c."LastReplyAt" IS DISTINCT FROM a."LastReplyAt";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The welcome card counted as an answer was the fault; nothing to put back.
        }
    }
}
