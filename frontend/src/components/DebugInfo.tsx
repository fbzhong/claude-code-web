import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Paper,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';

export interface DebugLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: string;
  message: string;
  details?: any;
}

interface DebugInfoProps {
  logs: DebugLog[];
  onClear: () => void;
  maxLogs?: number;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({ 
  logs, 
  onClear, 
  maxLogs = 50 
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const recentLogs = logs.slice(-maxLogs);
  const errorCount = recentLogs.filter(log => log.level === 'error').length;
  const warningCount = recentLogs.filter(log => log.level === 'warning').length;

  const getSeverityColor = (level: string) => {
    switch (level) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1300, maxWidth: '90vw' }}>
      <Accordion 
        expanded={expanded} 
        onChange={() => setExpanded(!expanded)}
        sx={{ 
          minWidth: 300,
          maxWidth: 500,
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: 'white',
          '& .MuiAccordionSummary-root': {
            backgroundColor: 'rgba(25,25,25,0.95)',
          }
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'white' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <BugIcon sx={{ fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Debug Info
            </Typography>
            {errorCount > 0 && (
              <Chip 
                label={errorCount} 
                size="small" 
                color="error" 
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            {warningCount > 0 && (
              <Chip 
                label={warningCount} 
                size="small" 
                color="warning" 
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            <Box sx={{ flexGrow: 1 }} />
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              sx={{ color: 'white' }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Box>
        </AccordionSummary>
        
        <AccordionDetails sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
          {recentLogs.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'grey.400' }}>
              <Typography variant="body2">No debug logs</Typography>
            </Box>
          ) : (
            <Box>
              {recentLogs.map((log) => (
                <Alert 
                  key={log.id} 
                  severity={getSeverityColor(log.level) as any}
                  sx={{ 
                    mb: 1, 
                    borderRadius: 0,
                    '& .MuiAlert-message': { 
                      width: '100%',
                      fontSize: '0.75rem'
                    }
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                        {log.category}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {formatTime(log.timestamp)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', mb: 1 }}>
                      {log.message}
                    </Typography>
                    {log.details && (
                      <Paper 
                        sx={{ 
                          p: 1, 
                          backgroundColor: 'rgba(0,0,0,0.3)', 
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          maxHeight: 100,
                          overflow: 'auto'
                        }}
                      >
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {typeof log.details === 'string' 
                            ? log.details 
                            : JSON.stringify(log.details, null, 2)
                          }
                        </pre>
                      </Paper>
                    )}
                  </Box>
                </Alert>
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

// Hook for managing debug logs
export const useDebugLogger = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);

  const addLog = (
    level: DebugLog['level'],
    category: string,
    message: string,
    details?: any
  ) => {
    const newLog: DebugLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      level,
      category,
      message,
      details
    };
    
    setLogs(prev => [...prev, newLog]);
  };

  const clearLogs = () => setLogs([]);

  const logInfo = (category: string, message: string, details?: any) => 
    addLog('info', category, message, details);
  
  const logWarning = (category: string, message: string, details?: any) => 
    addLog('warning', category, message, details);
  
  const logError = (category: string, message: string, details?: any) => 
    addLog('error', category, message, details);
  
  const logSuccess = (category: string, message: string, details?: any) => 
    addLog('success', category, message, details);

  return {
    logs,
    clearLogs,
    logInfo,
    logWarning,
    logError,
    logSuccess
  };
};