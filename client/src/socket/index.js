// client/src/socket/index.js
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('global');
  const [roomUsers, setRoomUsers] = useState([]);
  const [readMessages, setReadMessages] = useState(new Set());
  const [reactions, setReactions] = useState({});
  const [deliveredMessages, setDeliveredMessages] = useState(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  const connect = (username) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
      socket.emit('join_room', 'global');
    }
  };

  const disconnect = () => {
    socket.disconnect();
  };

  const sendMessage = (messageData) => {
    socket.emit('send_message', messageData);
  };

  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { to, message });
  };

  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  const joinRoom = (room) => {
    socket.emit('join_room', room);
  };

  const markMessageRead = (messageId, room) => {
    socket.emit('message_read', { messageId, room });
  };

  const reactToMessage = (messageId, reaction, room) => {
    socket.emit('react_message', { messageId, reaction, room });
  };

  const sendFile = (fileUrl, room) => {
    socket.emit('send_file', { fileUrl, room });
  };

  useEffect(() => {
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const audio = new Audio('/notification.mp3');

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
      if (message.sender !== localStorage.getItem('username') && !message.system) {
        setUnreadCount((prev) => prev + 1);
        new Notification(`New message from ${message.sender}`, {
          body: message.message || 'Image shared',
        });
        audio.play().catch((error) => console.error('Audio play failed:', error));
      }
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
      if (message.sender !== localStorage.getItem('username')) {
        setUnreadCount((prev) => prev + 1);
        new Notification(`Private message from ${message.sender}`, {
          body: message.message || 'Image shared',
        });
        audio.play().catch((error) => console.error('Audio play failed:', error));
      }
    };

    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    const onRoomJoined = (room) => {
      setCurrentRoom(room);
      setMessages([]); // Clear messages when joining a new room
    };

    const onRoomUsers = (users) => {
      setRoomUsers(users);
    };

    const onMessageRead = ({ messageId, userId }) => {
      if (userId !== socket.id) {
        setReadMessages((prev) => new Set(prev).add(messageId));
      }
    };

    const onMessageReaction = ({ messageId, reaction, userId }) => {
      setReactions((prev) => ({
        ...prev,
        [messageId]: { ...prev[messageId], [userId]: reaction },
      }));
    };

    const onMessageDelivered = ({ messageId }) => {
      setDeliveredMessages((prev) => new Set(prev).add(messageId));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('join_room', onRoomJoined);
    socket.on('room_users', onRoomUsers);
    socket.on('message_read', onMessageRead);
    socket.on('message_reaction', onMessageReaction);
    socket.on('message_delivered', onMessageDelivered);

    socket.on('reconnect', () => {
      const username = localStorage.getItem('username');
      if (username) {
        socket.emit('user_join', username);
        socket.emit('join_room', currentRoom);
      }
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('join_room', onRoomJoined);
      socket.off('room_users', onRoomUsers);
      socket.off('message_read', onMessageRead);
      socket.off('message_reaction', onMessageReaction);
      socket.off('message_delivered', onMessageDelivered);
      socket.off('reconnect');
    };
  }, [currentRoom]);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    currentRoom,
    roomUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    joinRoom,
    readMessages,
    markMessageRead,
    reactions,
    reactToMessage,
    sendFile,
    deliveredMessages,
    unreadCount,
  };
};

export default socket;