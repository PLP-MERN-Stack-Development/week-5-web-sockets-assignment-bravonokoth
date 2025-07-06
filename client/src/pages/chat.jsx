// client/src/pages/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../socket';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Select, MenuItem, List, ListItem, Typography, Box, ButtonGroup } from '@mui/material';
import axios from 'axios';

function Chat() {
  const {
    isConnected,
    messages,
    users,
    typingUsers,
    currentRoom,
    roomUsers,
    joinRoom,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    readMessages,
    markMessageRead,
    reactions,
    reactToMessage,
    sendFile,
    deliveredMessages,
    unreadCount,
  } = useSocket();
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [room, setRoom] = useState('');
  const [file, setFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) {
      navigate('/');
    }
    joinRoom('global');
  }, [navigate, joinRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      if (recipient) {
        sendPrivateMessage(recipient, message);
      } else {
        sendMessage({ message, room: currentRoom });
      }
      setMessage('');
      setTyping(false);
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    setTyping(e.target.value.length > 0);
  };

  const handleJoinRoom = () => {
    if (room.trim()) {
      joinRoom(room);
      setRoom('');
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFileUpload = async () => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await axios.post(`${SOCKET_URL}/api/upload`, formData);
        sendFile(res.data.fileUrl, currentRoom);
        setFile(null);
      } catch (error) {
        console.error('File upload failed:', error);
      }
    }
  };

  const handleReact = (messageId, reaction) => {
    reactToMessage(messageId, reaction, currentRoom);
  };

  const loadMoreMessages = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${SOCKET_URL}/api/messages?room=${currentRoom}&page=${page + 1}&limit=20`);
      setMessages((prev) => [...res.data, ...prev]);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
    setLoading(false);
  };

  const filteredMessages = messages.filter(
    (msg) =>
      !msg.system &&
      (msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Typography variant="h4">
        Chat Room: {currentRoom} (Unread: {unreadCount})
      </Typography>
      <Typography variant="subtitle1">
        {isConnected ? 'Connected' : 'Disconnected'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Room Name"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          fullWidth
        />
        <Button variant="contained" onClick={handleJoinRoom}>
          Join Room
        </Button>
      </Box>
      <TextField
        label="Search Messages"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ width: '30%' }}>
          <Typography variant="h6">Users in {currentRoom}</Typography>
          <List>
            {roomUsers.map((user) => (
              <ListItem
                key={user.id}
                onClick={() => setRecipient(user.username)}
                sx={{ cursor: 'pointer', fontWeight: recipient === user.username ? 'bold' : 'normal' }}
              >
                {user.username}
              </ListItem>
            ))}
          </List>
        </Box>
        <Box sx={{ width: '70%' }}>
          <Typography variant="h6">Messages</Typography>
          <Button onClick={loadMoreMessages} disabled={loading} sx={{ mb: 2 }}>
            {loading ? 'Loading...' : 'Load More'}
          </Button>
          <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
            {filteredMessages.map((msg) => (
              <Box
                key={msg.id}
                data-message-id={msg.id}
                sx={{ p: 1, borderBottom: '1px solid #eee' }}
                onClick={() => {
                  if (!readMessages.has(msg.id)) {
                    markMessageRead(msg.id, currentRoom);
                    setUnreadCount((prev) => Math.max(0, prev - 1));
                  }
                }}
              >
                {msg.system ? (
                  <Typography color="textSecondary">{msg.message}</Typography>
                ) : msg.isFile ? (
                  <>
                    <Typography>
                      <strong>{msg.sender}</strong>: <a href={msg.fileUrl} target="_blank">View Image</a>{' '}
                      <Typography component="span" color="textSecondary">
                        ({new Date(msg.timestamp).toLocaleTimeString()})
                      </Typography>
                    </Typography>
                    <img src={msg.fileUrl} alt="Shared" style={{ maxWidth: '200px' }} />
                  </>
                ) : (
                  <>
                    <Typography>
                      <strong>{msg.sender}</strong>: {msg.message}{' '}
                      <Typography component="span" color="textSecondary">
                        ({new Date(msg.timestamp).toLocaleTimeString()})
                      </Typography>
                      {msg.isPrivate && <Typography component="span"> (Private)</Typography>}
                      {deliveredMessages.has(msg.id) && !readMessages.has(msg.id) && (
                        <Typography component="span"> ✓</Typography>
                      )}
                      {readMessages.has(msg.id) && <Typography component="span"> ✓✓</Typography>}
                    </Typography>
                    <ButtonGroup size="small">
                      <Button onClick={() => handleReact(msg.id, '👍')}>👍</Button>
                      <Button onClick={() => handleReact(msg.id, '❤️')}>❤️</Button>
                    </ButtonGroup>
                    {reactions[msg.id] &&
                      Object.entries(reactions[msg.id]).map(([userId, reaction]) => (
                        <Typography key={userId} component="span">
                          {users.find((u) => u.id === userId)?.username || 'Unknown'}: {reaction}
                        </Typography>
                      ))}
                  </>
                )}
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>
          {typingUsers.length > 0 && (
            <Typography color="textSecondary">
              {typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...
            </Typography>
          )}
          <Box sx={{ mb: 2 }}>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <Button variant="contained" onClick={handleFileUpload} disabled={!file}>
              Upload Image
            </Button>
          </Box>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
            <Select
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              displayEmpty
              fullWidth
            >
              <MenuItem value="">Global Chat ({currentRoom})</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.username}>
                  {user.username}
                </MenuItem>
              ))}
            </Select>
            <TextField
              value={message}
              onChange={handleTyping}
              placeholder="Type a message..."
              fullWidth
            />
            <Button type="submit" variant="contained">
              Send
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
}

export default Chat;