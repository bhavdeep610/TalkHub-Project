using System;

namespace ChatApp.Models.Entities
{
    public class ProfilePicture
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string ImageUrl { get; set; }
        public string PublicId { get; set; }
        public DateTime UploadedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation property
        public virtual User User { get; set; }
    }
} 