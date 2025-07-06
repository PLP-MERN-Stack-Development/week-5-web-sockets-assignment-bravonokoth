// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
  },
});

// Store connected users, messages, and typing users
const users = {};
const messages = [];
const typingUsers = {};
const rooms = new Map(); // Map room name to user IDs

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('user_join', (username) => {
    users[socket.id] = { username, id: socket.id };
    io.emit('user_list', Object.values(users));
    io.emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the chat`);
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room).add(socket.id);
    io.to(room).emit('receive_message', {
      id: Date.now(),
      system: true,
      message: `${users[socket.id]?.username || 'Anonymous'} joined ${room}`,
      timestamp: new Date().toISOString(),
    });
    io.to(room).emit('room_users', Array.from(rooms.get(room)).map((id) => users[id] || { id, username: 'Anonymous' }));
    socket.emit('join_room', room); // Confirm room join to client
  });

  socket.on('send_message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      timestamp: new Date().toISOString(),
    };
    messages.push(message);
    if (messages.length > 100) {
      messages.shift();
    }
    io.to(messageData.room || 'global').emit('receive_message', message);
    socket.emit('message_delivered', { messageId: message.id });
  });

  socket.on('private_message', ({ to, message }) => {
    const recipientId = Object.values(users).find((user) => user.username === to)?.id;
    if (recipientId) {
      const messageData = {
        id: Date.now(),
        sender: users[socket.id]?.username || 'Anonymous',
        senderId: socket.id,
        message,
        timestamp: new Date().toISOString(),
        isPrivate: true,
      };
      socket.to(recipientId).emit('private_message', messageData);
      socket.emit('private_message', messageData);
      messages.push(messageData);
      if (messages.length > 100) {
        messages.shift();
      }
    }
  });

  socket.on('typing', (isTyping) => {
    if (users[socket.id]) {
      const username = users[socket.id].username;
      const room = Array.from(rooms.entries()).find(([_, userSet]) => userSet.has(socket.id))?.[0] || 'global';
      if (isTyping) {
        typingUsers[socket.id] = username;
      } else {
        delete typingUsers[socket.id];
      }
      io.to(room).emit('typing_users', Object.values(typingUsers));
    }
  });

  socket.on('message_read', ({ messageId, room }) => {
    io.to(room || 'global').emit('message_read', { messageId, userId: socket.id });
  });

  socket.on('react_message', ({ messageId, reaction, room }) => {
    const message = messages.find((msg) => msg.id === messageId);
    if (message) {
      message.reactions = message.reactions || {};
      message.reactions[socket.id] = reaction;
      io.to(room || 'global').emit('message_reaction', { messageId, reaction, userId: socket.id });
    }
  });

  socket.on('send_file', ({ fileUrl, room }) => {
    const message = {
      id: Date.now(),
      sender: users[socket.id]?.username || 'Anonymous',
      senderId: socket.id,
      fileUrl,
      timestamp: new Date().toISOString(),
      isFile: true,
    };
    messages.push(message);
    if (messages.length > 100) {
      messages.shift();
    }
    io.to(room || 'global').emit('receive_message', message);
  });

  socket.on('disconnect', () => {
    const username = users[socket.id]?.username || 'Anonymous';
    for (const [room, userSet] of rooms.entries()) {
      if (userSet.has(socket.id)) {
        userSet.delete(socket.id);
        io.to(room).emit('receive_message', {
          id: Date.now(),
          system: true,
          message: `${username} left ${room}`,
          timestamp: new Date().toISOString(),
        });
        io.to(room).emit('room_users', Array.from(userSet).map((id) => users[id] || { id, username: 'Anonymous' }));
        if (userSet.size === 0) {
          rooms.delete(room);
        }
      }
    }
    if (users[socket.id]) {
      io.emit('user_left', { username, id: socket.id });
    }
    delete users[socket.id];
    delete typingUsers[socket.id];
    io.emit('user_list', Object.values(users));
    io.emit('typing_users', Object.values(typingUsers));
  });
});

// API routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

app.get('/api/messages', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const room = req.query.room || 'global';
  const start = (page - 1) * limit;
  const end = start + limit;
  const roomMessages = messages.filter((msg) => (msg.room || 'global') === room).slice(start, end);
  res.json(roomMessages);
});

app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };