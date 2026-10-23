using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ZaloInbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_zalo_conversations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ZaloUserId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AvatarUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SharedPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMessagePreview = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LastMessageDirection = table.Column<short>(type: "smallint", nullable: true),
                    LastCustomerMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastReplyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HolderId = table.Column<Guid>(type: "uuid", nullable: true),
                    HeldUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Tags = table.Column<string[]>(type: "text[]", nullable: false),
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
                    table.PrimaryKey("PK_bd_zalo_conversations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_care_notes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: true),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Outcome = table.Column<short>(type: "smallint", nullable: true),
                    AuthorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastEditorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastEditedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RemoverId = table.Column<Guid>(type: "uuid", nullable: true),
                    RemovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_care_notes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_care_notes_bd_zalo_conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "bd_zalo_conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_zalo_chat_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ZaloMessageId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Direction = table.Column<short>(type: "smallint", nullable: false),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    AttachmentUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SenderUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_zalo_chat_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_zalo_chat_messages_bd_zalo_conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "bd_zalo_conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_care_note_revisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    NoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<short>(type: "smallint", nullable: false),
                    Before = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    After = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_care_note_revisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_care_note_revisions_bd_care_notes_NoteId",
                        column: x => x.NoteId,
                        principalTable: "bd_care_notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_note_revisions_NoteId",
                table: "bd_care_note_revisions",
                column: "NoteId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_notes_ClinicBranchId_PatientId_CreatedAt",
                table: "bd_care_notes",
                columns: new[] { "ClinicBranchId", "PatientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_notes_ConversationId_CreatedAt",
                table: "bd_care_notes",
                columns: new[] { "ConversationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_chat_messages_ClinicBranchId_ZaloMessageId",
                table: "bd_zalo_chat_messages",
                columns: new[] { "ClinicBranchId", "ZaloMessageId" },
                unique: true,
                filter: "\"ZaloMessageId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_chat_messages_ConversationId_SentAt",
                table: "bd_zalo_chat_messages",
                columns: new[] { "ConversationId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_conversations_ClinicBranchId_PatientId",
                table: "bd_zalo_conversations",
                columns: new[] { "ClinicBranchId", "PatientId" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_conversations_ClinicBranchId_Status_LastMessageAt",
                table: "bd_zalo_conversations",
                columns: new[] { "ClinicBranchId", "Status", "LastMessageAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_zalo_conversations_ClinicBranchId_ZaloUserId",
                table: "bd_zalo_conversations",
                columns: new[] { "ClinicBranchId", "ZaloUserId" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_care_note_revisions");

            migrationBuilder.DropTable(
                name: "bd_zalo_chat_messages");

            migrationBuilder.DropTable(
                name: "bd_care_notes");

            migrationBuilder.DropTable(
                name: "bd_zalo_conversations");
        }
    }
}
