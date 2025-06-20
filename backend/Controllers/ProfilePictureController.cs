using ChatApp.Models.DTOs;
using ChatApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ChatApp.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ProfilePictureController : ControllerBase
    {
        private readonly ProfilePictureService _profilePictureService;

        public ProfilePictureController(ProfilePictureService profilePictureService)
        {
            _profilePictureService = profilePictureService;
        }

        [HttpPost("upload")]
        public async Task<ActionResult<ProfilePictureResponseDTO>> UploadProfilePicture([FromForm] ProfilePictureUploadDTO request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            try
            {
                var result = await _profilePictureService.UploadProfilePictureAsync(userId, request.File);
                return Ok(result);
            }
            catch (System.ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{userId:int}")]
        public async Task<ActionResult<ProfilePictureResponseDTO>> GetProfilePicture(int userId)
        {
            var result = await _profilePictureService.GetProfilePictureAsync(userId);
            if (result == null)
                return NotFound();

            return Ok(result);
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteProfilePicture()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var result = await _profilePictureService.DeleteProfilePictureAsync(userId);
            if (!result)
                return NotFound();

            return NoContent();
        }
    }
} 