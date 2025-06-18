using ChatApp.Data;
using ChatApp.Models;
using ChatApp.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
namespace ChatApp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ChatController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] MessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Message content is required.");

        int senderId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var sender = await _context.Users.FindAsync(senderId);
        var receiver = await _context.Users.FindAsync(dto.ReceiverID);

        if (sender == null || receiver == null)
        {
            return BadRequest("Invalid sender or receiver");
        }

        var message = new Message
        {
            SenderId = senderId,
            ReceiverId = dto.ReceiverID,
            Content = dto.Content,
            Created = DateTime.UtcNow,
            Sender = sender,
            Receiver = receiver
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var response = new
        {
            id = message.MessageId,
            content = message.Content,
            senderId = message.SenderId,
            receiverId = message.ReceiverId,
            created = message.Created,
            senderName = sender.UserName,
            receiverName = receiver.UserName
        };

        return Ok(response);
    }

    [HttpGet("get/{receiverId}")]
    public async Task<IActionResult> GetMessages(int receiverId)
    {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var messages = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.Receiver)
            .Where(m => (m.SenderId == userId && m.ReceiverId == receiverId) ||
                       (m.SenderId == receiverId && m.ReceiverId == userId))
            .OrderBy(m => m.Created)
            .Select(m => new
            {
                id = m.MessageId,
                content = m.Content,
                senderId = m.SenderId,
                receiverId = m.ReceiverId,
                created = m.Created,
                senderName = m.Sender.UserName,
                receiverName = m.Receiver.UserName
            })
            .ToListAsync();

        var sortedMessages = messages
            .OrderBy(m => m.created)
            .ThenBy(m => m.id)
            .ToList();

        return Ok(sortedMessages);
    }

    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateMessage(int id, [FromBody] UpdateMessage dto)
    {
        try
        {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var message = await _context.Messages.FindAsync(id);

        message.Content = dto.NewContent;
        await _context.SaveChangesAsync();

            var senderName = await _context.Users
                .Where(u => u.Id == message.SenderId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync();

            var receiverName = await _context.Users
                .Where(u => u.Id == message.ReceiverId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync();

            return Ok(new
            {
                id = message.MessageId,
                content = message.Content,
                senderId = message.SenderId,
                receiverId = message.ReceiverId,
                created = message.Created,
                senderName = senderName,
                receiverName = receiverName
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"An error occurred while updating the message: {ex.Message}");
        }
    }

    [HttpDelete("delete/{id}")]
    public async Task<IActionResult> DeleteMessage(int id)
    {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var message = await _context.Messages.FindAsync(id);

        

        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();

        return NoContent();
    }
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var users = await _context.Users
                .Where(u => u.Id != currentUserId)
                .OrderBy(u => u.UserName) 
                .Select(u => new
                {
                    id = u.Id,
                    username = u.UserName,
                })
                .ToListAsync();

            return Ok(users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch users", error = ex.Message });
        }
    }

   

    [HttpGet("user/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        try
        {
            var user = await _context.Users
                .Where(u => u.Id == id)
                .Select(u => new
                {
                    id = u.Id,
                    username = u.UserName,
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound(new { message = $"User with ID {id} not found" });
            }

            return Ok(user);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to fetch user", error = ex.Message });
        }
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var currentUsername = User.FindFirst(ClaimTypes.Name)?.Value;
            
            Console.WriteLine($"Getting conversations for user ID: {currentUserId}, Username: {currentUsername}");
            
            var currentUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == currentUserId);
                
            if (currentUser == null)
            {
                Console.WriteLine($"Warning: User {currentUserId} not found in database");
                return NotFound(new { message = "User not found" });
            }

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver) 
                .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                .OrderByDescending(m => m.Created)
                .ToListAsync();

            Console.WriteLine($"Found {messages.Count} messages for user {currentUserId}");

            var userIds = messages
                .SelectMany(m => new[] { m.SenderId, m.ReceiverId })
                .Where(id => id != currentUserId)
                .Distinct()
                .ToList();

            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id);

            var conversations = messages
                .GroupBy(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var partnerId = g.Key;
                    var lastMessage = g.First(); 
                    users.TryGetValue(partnerId, out var partner);

                    if (partner == null)
                    {
                        Console.WriteLine($"Warning: Could not find user data for ID: {partnerId}");
                    }
                    else
                    {
                        Console.WriteLine($"Found conversation partner: ID={partner.Id}, Username={partner.UserName}");
                    }

                    return new
                    {
                        user = new
                        {
                            id = partnerId,
                            username = partner?.UserName ?? $"User {partnerId}",
                            email = partner?.Email
                        },
                        lastMessage = new
                        {
                            id = lastMessage.MessageId,
                            content = lastMessage.Content,
                            senderId = lastMessage.SenderId,
                            receiverId = lastMessage.ReceiverId,
                            created = lastMessage.Created,
                            senderName = lastMessage.SenderId == currentUserId ? currentUsername : partner?.UserName ?? $"User {lastMessage.SenderId}",
                            receiverName = lastMessage.ReceiverId == currentUserId ? currentUsername : partner?.UserName ?? $"User {lastMessage.ReceiverId}"
                        },
                        hasMessages = true
                    };
                })
                .ToList();

            Console.WriteLine($"Returning {conversations.Count} conversations");
            return Ok(conversations);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in GetConversations: {ex}");
            return StatusCode(500, new { message = ex.Message });
        }
    }
}