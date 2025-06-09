using Microsoft.AspNetCore.Http;
using System;

namespace ChatApp.Models.DTOs
{
    public class ProfilePictureResponseDTO
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string ImageUrl { get; set; }
        public DateTime UploadedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ProfilePictureUploadDTO
    {
        public IFormFile File { get; set; }
    }
} 