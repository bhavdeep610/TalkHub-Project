using ChatApp.Data;
using ChatApp.Models.DTOs;
using ChatApp.Models.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace ChatApp.Services
{
    public class ProfilePictureService
    {
        private readonly ApplicationDbContext _context;
        private readonly CloudinaryService _cloudinaryService;

        public ProfilePictureService(ApplicationDbContext context, CloudinaryService cloudinaryService)
        {
            _context = context;
            _cloudinaryService = cloudinaryService;
        }

        public async Task<ProfilePictureResponseDTO> UploadProfilePictureAsync(int userId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file was uploaded.");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif" };
            if (!Array.Exists(allowedTypes, type => type == file.ContentType))
                throw new ArgumentException("Invalid file type. Only JPEG, PNG, and GIF are allowed.");

            var existingPicture = await _context.ProfilePictures.FirstOrDefaultAsync(p => p.UserId == userId);
            if (existingPicture != null)
            {
                await _cloudinaryService.DeleteProfilePictureAsync(existingPicture.PublicId);
                _context.ProfilePictures.Remove(existingPicture);
            }

            var uploadResult = await _cloudinaryService.UploadProfilePictureAsync(file, userId);

            var profilePicture = new ProfilePicture
            {
                UserId = userId,
                ImageUrl = uploadResult.Url,
                PublicId = uploadResult.PublicId,
                UploadedAt = DateTime.UtcNow
            };

            _context.ProfilePictures.Add(profilePicture);
            await _context.SaveChangesAsync();

            return new ProfilePictureResponseDTO
            {
                Id = profilePicture.Id,
                UserId = profilePicture.UserId,
                ImageUrl = profilePicture.ImageUrl,
                UploadedAt = profilePicture.UploadedAt,
                UpdatedAt = profilePicture.UpdatedAt
            };
        }

        public async Task<ProfilePictureResponseDTO> GetProfilePictureAsync(int userId)
        {
            var profilePicture = await _context.ProfilePictures
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profilePicture == null)
                return new ProfilePictureResponseDTO
                {
                    UserId = userId,
                    ImageUrl = null,
                    UploadedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

            return new ProfilePictureResponseDTO
            {
                Id = profilePicture.Id,
                UserId = profilePicture.UserId,
                ImageUrl = profilePicture.ImageUrl,
                UploadedAt = profilePicture.UploadedAt,
                UpdatedAt = profilePicture.UpdatedAt
            };
        }

        public async Task<bool> DeleteProfilePictureAsync(int userId)
        {
            var profilePicture = await _context.ProfilePictures
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (profilePicture == null)
                return false;

            await _cloudinaryService.DeleteProfilePictureAsync(profilePicture.PublicId);

            _context.ProfilePictures.Remove(profilePicture);
            await _context.SaveChangesAsync();

            return true;
        }
    }
} 