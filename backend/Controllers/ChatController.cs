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

        var message = new Message
        {
            SenderId = senderId,
            ReceiverId = dto.ReceiverID,
            Content = dto.Content,
            Created = DateTime.UtcNow
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
            senderName = await _context.Users
                .Where(u => u.Id == message.SenderId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync(),
            receiverName = await _context.Users
                .Where(u => u.Id == message.ReceiverId)
                .Select(u => u.UserName)
                .FirstOrDefaultAsync()
        };

        return Ok(response);
    }

    [HttpGet("get/{receiverId}")]
    public async Task<IActionResult> GetMessages(int receiverId)
    {
        int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var messages = await _context.Messages
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
                senderName = _context.Users
                    .Where(u => u.Id == m.SenderId)
                    .Select(u => u.UserName)
                    .FirstOrDefault(),
                receiverName = _context.Users
                    .Where(u => u.Id == m.ReceiverId)
                    .Select(u => u.UserName)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpPut("update/{id}")]
    public async Task<IActionResult> UpdateMessage(int id, [FromBody] UpdateMessage dto)
    {
        try
        {
            int userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var message = await _context.Messages.FindAsync(id);

            if (message == null)
                return NotFound("Message not found");

            if (message.SenderId != userId)
                return Forbid("You can only edit your own messages");

            if (string.IsNullOrWhiteSpace(dto.NewContent))
                return BadRequest("Message content cannot be empty");

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

        if (message == null)
            return NotFound();

        if (message.SenderId != userId)
            return Forbid();

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
                .Where(u => u.Id != currentUserId) // exclude self
                .OrderBy(u => u.UserName) // Add consistent ordering
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
    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<Message>>> GetAllMessages()
    {
        try
        {
            var messages = await _context.Messages
                .OrderByDescending(m => m.Created)
                .ToListAsync();

            return Ok(messages);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }

    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _context.Users
            .Where(u => u.Id == id)
            .Select(u => new
            {
                id = u.Id,
                username = u.UserName
            })
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound();

        return Ok(user);
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

    [HttpGet("debug/current-user")]
    public async Task<IActionResult> GetCurrentUserDebug()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var username = User.FindFirst(ClaimTypes.Name)?.Value;
            
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == currentUserId);
                
            if (user == null)
            {
                return NotFound(new { 
                    message = "User not found in database",
                    tokenId = currentUserId,
                    tokenUsername = username
                });
            }
            
            return Ok(new {
                id = user.Id,
                userName = user.UserName,
                email = user.Email,
                tokenId = currentUserId,
                tokenUsername = username
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("debug/messages/{userId}")]
    public async Task<IActionResult> GetMessagesDebug(int userId)
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => (m.SenderId == currentUserId && m.ReceiverId == userId) ||
                           (m.SenderId == userId && m.ReceiverId == currentUserId))
                .OrderByDescending(m => m.Created)
                .Take(10)
                .Select(m => new
                {
                    MessageId = m.MessageId,
                    Content = m.Content,
                    Created = m.Created,
                    Sender = new { m.SenderId, Username = m.Sender.UserName },
                    Receiver = new { m.ReceiverId, Username = m.Receiver.UserName }
                })
                .ToListAsync();

            return Ok(new
            {
                CurrentUserId = currentUserId,
                PartnerUserId = userId,
                MessageCount = messages.Count,
                Messages = messages
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error getting messages: {ex.Message}");
        }
    }

    [HttpGet("debug/conversations")]
    public async Task<IActionResult> GetConversationsDebug()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                .OrderByDescending(m => m.Created)
                .ToListAsync();

            var conversations = messages
                .GroupBy(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var partnerId = g.Key;
                    var lastMessage = g.First();
                    var partner = lastMessage.SenderId == partnerId ? lastMessage.Sender : lastMessage.Receiver;

                    return new
                    {
                        PartnerId = partnerId,
                        PartnerUsername = partner?.UserName,
                        LastMessage = new
                        {
                            lastMessage.MessageId,
                            lastMessage.Content,
                            lastMessage.Created,
                            SenderName = lastMessage.Sender?.UserName,
                            ReceiverName = lastMessage.Receiver?.UserName
                        },
                        MessageCount = g.Count()
                    };
                })
                .ToList();

            return Ok(new
            {
                CurrentUserId = currentUserId,
                ConversationCount = conversations.Count,
                Conversations = conversations
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error getting conversations: {ex.Message}");
        }
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var currentUsername = User.FindFirst(ClaimTypes.Name)?.Value;
            
            // Log the current user info
            Console.WriteLine($"Getting conversations for user ID: {currentUserId}, Username: {currentUsername}");
            
            // First verify the user exists
            var currentUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == currentUserId);
                
            if (currentUser == null)
            {
                Console.WriteLine($"Warning: User {currentUserId} not found in database");
                return NotFound(new { message = "User not found" });
            }

            // Get all messages for the current user
            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                .OrderByDescending(m => m.Created)
                .ToListAsync();

            Console.WriteLine($"Found {messages.Count} messages for user {currentUserId}");

            // Get all unique user IDs from messages
            var userIds = messages
                .SelectMany(m => new[] { m.SenderId, m.ReceiverId })
                .Where(id => id != currentUserId)
                .Distinct()
                .ToList();

            // Get all users involved in conversations
            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id);

            // Group messages by conversation partner
            var conversations = messages
                .GroupBy(m => m.SenderId == currentUserId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var partnerId = g.Key;
                    var lastMessage = g.First(); // Already ordered by Created desc
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

    [HttpGet("history")]
    public async Task<IActionResult> GetChatHistory()
    {
        try
        {
            int currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

            var messages = await _context.Messages
                .Where(m => m.SenderId == currentUserId || m.ReceiverId == currentUserId)
                .OrderByDescending(m => m.Created)
                .Select(m => new
                {
                    id = m.MessageId,
                    content = m.Content,
                    senderId = m.SenderId,
                    receiverId = m.ReceiverId,
                    created = m.Created,
                    senderName = _context.Users
                        .Where(u => u.Id == m.SenderId)
                        .Select(u => u.UserName)
                        .FirstOrDefault(),
                    receiverName = _context.Users
                        .Where(u => u.Id == m.ReceiverId)
                        .Select(u => u.UserName)
                        .FirstOrDefault()
                })
                .Take(100)
                .ToListAsync();

            return Ok(messages);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}