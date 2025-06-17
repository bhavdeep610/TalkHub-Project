using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using ChatApp.Data;
using ChatApp.Models;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ChatHub> _logger;
        private static readonly ConcurrentDictionary<string, UserConnection> _userConnections = new();

        private class UserConnection
        {
            public string ConnectionId { get; set; }
            public string Username { get; set; }
            public bool IsOnline { get; set; }
            public DateTime LastSeen { get; set; }
        }

        public ChatHub(ApplicationDbContext context, ILogger<ChatHub> logger)
        {
            _context = context;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            try
            {
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(username))
                {
                    _logger.LogWarning("Connection attempt without valid user credentials");
                    Context.Abort();
                    return;
                }

                // Update user connection info
                var connection = new UserConnection
                {
                    ConnectionId = Context.ConnectionId,
                    Username = username,
                    IsOnline = true,
                    LastSeen = DateTime.UtcNow
                };

                _userConnections.AddOrUpdate(userId, connection, (_, __) => connection);

                // Add user to their personal group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{userId}");

                // Notify others that user is online
                await Clients.Others.SendAsync("UserOnline", new
                {
                    UserId = userId,
                    Username = username,
                    IsOnline = true,
                    LastSeen = DateTime.UtcNow
                });

                _logger.LogInformation($"User {username} (ID: {userId}) connected with connection ID {Context.ConnectionId}");
                await base.OnConnectedAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnConnectedAsync");
                throw;
            }
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            try
            {
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var username = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (!string.IsNullOrEmpty(userId))
                {
                    if (_userConnections.TryGetValue(userId, out var connection) &&
                        connection.ConnectionId == Context.ConnectionId)
                    {
                        connection.IsOnline = false;
                        connection.LastSeen = DateTime.UtcNow;
                        _userConnections.TryUpdate(userId, connection, connection);

                        // Remove from personal group
                        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"User_{userId}");

                        // Notify others that user is offline
                        await Clients.Others.SendAsync("UserOffline", new
                        {
                            UserId = userId,
                            Username = username,
                            LastSeen = DateTime.UtcNow
                        });

                        _logger.LogInformation($"User {username} (ID: {userId}) disconnected");
                    }
                }

                if (exception != null)
                {
                    _logger.LogWarning(exception, "Client disconnected with error");
                }

                await base.OnDisconnectedAsync(exception);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in OnDisconnectedAsync");
                throw;
            }
        }

        public async Task SendMessage(string receiverId, string message)
        {
            try
            {
                var senderId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var senderUsername = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (string.IsNullOrEmpty(senderId) || string.IsNullOrEmpty(message))
                {
                    throw new HubException("Invalid sender or message");
                }

                // Validate message
                if (message.Length > 1000)
                {
                    throw new HubException("Message too long (max 1000 characters)");
                }

                // Create message entity
                var chatMessage = new Message
                {
                    SenderId = int.Parse(senderId),
                    ReceiverId = int.Parse(receiverId),
                    Content = message,
                    Created = DateTime.UtcNow
                };

                // Save to database
                _context.Messages.Add(chatMessage);
                await _context.SaveChangesAsync();

                // Prepare message data
                var messageData = new
                {
                    Id = chatMessage.MessageId,
                    SenderId = senderId,
                    SenderUsername = senderUsername,
                    ReceiverId = receiverId,
                    Content = message,
                    Timestamp = chatMessage.Created,
                    IsDelivered = _userConnections.TryGetValue(receiverId, out var receiverConnection) && 
                                receiverConnection.IsOnline
                };

                // Send to receiver
                await Clients.Group($"User_{receiverId}").SendAsync("ReceiveMessage", messageData);

                // Send confirmation to sender
                await Clients.Caller.SendAsync("MessageSent", messageData);

                _logger.LogInformation($"Message sent from {senderId} to {receiverId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message");
                throw new HubException($"Failed to send message: {ex.Message}");
            }
        }

        public async Task JoinChat(string chatId)
        {
            try
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Chat_{chatId}");
                _logger.LogInformation($"User joined chat {chatId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error joining chat {chatId}");
                throw new HubException($"Failed to join chat: {ex.Message}");
            }
        }

        public async Task LeaveChat(string chatId)
        {
            try
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Chat_{chatId}");
                _logger.LogInformation($"User left chat {chatId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error leaving chat {chatId}");
                throw new HubException($"Failed to leave chat: {ex.Message}");
            }
        }

        public async Task<List<object>> GetOnlineUsers()
        {
            try
            {
                var onlineUsers = _userConnections
                    .Where(x => x.Value.IsOnline)
                    .Select(x => new
                    {
                        UserId = x.Key,
                        Username = x.Value.Username,
                        LastSeen = x.Value.LastSeen
                    })
                    .ToList<object>();

                return onlineUsers;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting online users");
                throw new HubException($"Failed to get online users: {ex.Message}");
            }
        }

        public async Task TypingNotification(string receiverId, bool isTyping)
        {
            try
            {
                var senderId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var senderUsername = Context.User?.FindFirst(ClaimTypes.Name)?.Value;

                if (string.IsNullOrEmpty(senderId))
                {
                    throw new HubException("Invalid sender");
                }

                await Clients.Group($"User_{receiverId}").SendAsync("UserTyping", new
                {
                    UserId = senderId,
                    Username = senderUsername,
                    IsTyping = isTyping
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending typing notification");
                throw new HubException($"Failed to send typing notification: {ex.Message}");
            }
        }

        public async Task UpdateMessage(int messageId, string newContent)
        {
            try
            {
                _logger.LogInformation($"Received UpdateMessage request - MessageId: {messageId}, NewContent: {newContent}");
                
                var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("UpdateMessage failed - Invalid user");
                    throw new HubException("Invalid user");
                }

                _logger.LogInformation($"Processing update for MessageId: {messageId} by UserId: {userId}");

                // Find the message
                var message = await _context.Messages.FindAsync(messageId);
                if (message == null)
                {
                    _logger.LogWarning($"UpdateMessage failed - Message {messageId} not found");
                    throw new HubException("Message not found");
                }

                // Verify ownership
                if (message.SenderId.ToString() != userId)
                {
                    _logger.LogWarning($"UpdateMessage failed - User {userId} not authorized to update message {messageId}");
                    throw new HubException("Not authorized to update this message");
                }

                // Update message
                message.Content = newContent;
                message.Updated = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Notify both sender and receiver
                var messageData = new
                {
                    Id = message.MessageId,
                    SenderId = message.SenderId.ToString(),
                    ReceiverId = message.ReceiverId.ToString(),
                    Content = newContent,
                    Timestamp = message.Created,
                    Updated = message.Updated
                };

                _logger.LogInformation($"Broadcasting message update - MessageId: {messageId}, SenderId: {message.SenderId}, ReceiverId: {message.ReceiverId}");

                await Clients.Group($"User_{message.SenderId}").SendAsync("MessageUpdated", messageData);
                await Clients.Group($"User_{message.ReceiverId}").SendAsync("MessageUpdated", messageData);

                _logger.LogInformation($"Message {messageId} successfully updated by user {userId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating message {messageId}");
                throw new HubException($"Failed to update message: {ex.Message}");
            }
        }
    }
}
