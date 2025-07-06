// client/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../socket';
import { Box, TextField, Button, Typography } from '@mui/material';

function Login() {
  const [username, setUsername] = useState('');
  const { connect } = useSocket();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('username', username);
      connect(username);
      navigate('/chat');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Enter Username
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button type="submit" variant="contained" fullWidth>
          Join Chat
        </Button>
      </form>
    </Box>
  );
}

export default Login;