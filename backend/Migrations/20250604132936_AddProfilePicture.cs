using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ChatApp.Migrations
{
    /// <inheritdoc />
    public partial class AddProfilePicture : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProfilePictureUrl",
                table: "user",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "profile_picture",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<int>(type: "int", nullable: false),
                    ImageUrl = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PublicId = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    uploaded_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_picture", x => x.id);
                    table.ForeignKey(
                        name: "FK_profile_picture_user_user_id",
                        column: x => x.user_id,
                        principalTable: "user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(5490));

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(5491));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                columns: new[] { "created", "ProfilePictureUrl" },
                values: new object[] { new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4844), null });

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                columns: new[] { "created", "ProfilePictureUrl" },
                values: new object[] { new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4846), null });

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                columns: new[] { "created", "ProfilePictureUrl" },
                values: new object[] { new DateTime(2025, 6, 4, 13, 29, 36, 109, DateTimeKind.Utc).AddTicks(4848), null });

            migrationBuilder.CreateIndex(
                name: "IX_profile_picture_user_id",
                table: "profile_picture",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "profile_picture");

            migrationBuilder.DropColumn(
                name: "ProfilePictureUrl",
                table: "user");

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 32, 46, 239, DateTimeKind.Utc).AddTicks(4583));

            migrationBuilder.UpdateData(
                table: "message",
                keyColumn: "message_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 32, 46, 239, DateTimeKind.Utc).AddTicks(4585));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 1,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 32, 46, 239, DateTimeKind.Utc).AddTicks(3528));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 2,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 32, 46, 239, DateTimeKind.Utc).AddTicks(3532));

            migrationBuilder.UpdateData(
                table: "user",
                keyColumn: "user_id",
                keyValue: 3,
                column: "created",
                value: new DateTime(2025, 5, 23, 7, 32, 46, 239, DateTimeKind.Utc).AddTicks(3533));
        }
    }
}
