import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper } from '@mui/material';
import { sessionApi } from '../services/sessionApi';
import { SessionInfo } from './SessionList';

export const SessionDebug: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const fetchSessions = async () => {
    try {
      addLog('Fetching sessions...');
      const sessionList = await sessionApi.getAllSessions();
      addLog(`Received ${sessionList.length} sessions`);
      addLog(`Sessions: ${JSON.stringify(sessionList.map(s => ({ id: s.id, name: s.name })))}`);
      setSessions(sessionList);
    } catch (error: any) {
      addLog(`Error fetching sessions: ${error.message}`);
    }
  };

  const createSession = async () => {
    try {
      const name = `Debug Session ${Date.now()}`;
      addLog(`Creating session: ${name}`);
      const newSession = await sessionApi.createSession({ name });
      addLog(`Created session: ${JSON.stringify({ id: newSession.id, name: newSession.name })}`);
      
      // Immediately fetch sessions again
      await fetchSessions();
    } catch (error: any) {
      addLog(`Error creating session: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <Paper sx={{ p: 2, m: 2, bgcolor: 'rgba(0,0,0,0.8)', color: '#fff' }}>
      <Typography variant="h6" gutterBottom>Session Debug Panel</Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Current sessions: {sessions.length}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" onClick={fetchSessions}>
            Refresh Sessions
          </Button>
          <Button variant="contained" size="small" color="success" onClick={createSession}>
            Create Test Session
          </Button>
        </Box>
      </Box>

      <Box sx={{ 
        maxHeight: 200, 
        overflow: 'auto', 
        bgcolor: 'rgba(0,0,0,0.4)', 
        p: 1, 
        borderRadius: 1,
        fontFamily: 'monospace',
        fontSize: '0.75rem'
      }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>Sessions:</Typography>
        {sessions.map(session => (
          <Box key={session.id} sx={{ ml: 2, fontSize: '0.75rem' }}>
            - {session.name} (ID: {session.id})
          </Box>
        ))}
      </Box>
    </Paper>
  );
};