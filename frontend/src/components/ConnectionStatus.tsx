import React from 'react';
import {
  Chip,
  Button,
  CircularProgress,
  Tooltip,
  Box,
} from '@mui/material';
import {
  WifiOff,
  Wifi,
  CloudSync,
  SyncProblem,
  Refresh,
} from '@mui/icons-material';
import { ConnectionState } from '../hooks/useConnectionManager';

interface ConnectionStatusProps {
  connectionState: ConnectionState;
  canManualReconnect: boolean;
  onManualReconnect: () => void;
  reconnectAttempt?: number;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connectionState,
  canManualReconnect,
  onManualReconnect,
  reconnectAttempt,
}) => {
  const getStatusConfig = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return {
          label: '已连接',
          color: 'success' as const,
          icon: <Wifi fontSize="small" />,
          showProgress: false,
        };
      case ConnectionState.CONNECTING:
        return {
          label: '连接中...',
          color: 'default' as const,
          icon: <CircularProgress size={16} />,
          showProgress: true,
        };
      case ConnectionState.RECONNECTING:
        return {
          label: `重连中... (${reconnectAttempt || 1})`,
          color: 'warning' as const,
          icon: <CloudSync fontSize="small" />,
          showProgress: true,
        };
      case ConnectionState.DISCONNECTED:
        return {
          label: '已断开',
          color: 'default' as const,
          icon: <WifiOff fontSize="small" />,
          showProgress: false,
        };
      case ConnectionState.FAILED:
        return {
          label: '连接失败',
          color: 'error' as const,
          icon: <SyncProblem fontSize="small" />,
          showProgress: false,
        };
      default:
        return {
          label: '未知',
          color: 'default' as const,
          icon: null,
          showProgress: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={`连接状态: ${config.label}`}>
        <Chip
          label={config.label}
          color={config.color}
          icon={config.icon || undefined}
          size="small"
          sx={{
            '& .MuiChip-icon': {
              marginLeft: '8px',
            },
          }}
        />
      </Tooltip>
      
      {canManualReconnect && (
        <Tooltip title="手动重新连接">
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<Refresh />}
            onClick={onManualReconnect}
            sx={{ minWidth: 'auto', px: 1 }}
          >
            重连
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};

// Mini version for mobile or compact layouts
export const ConnectionStatusMini: React.FC<ConnectionStatusProps> = ({
  connectionState,
  canManualReconnect,
  onManualReconnect,
}) => {
  const getStatusIcon = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return <Wifi sx={{ color: 'success.main' }} fontSize="small" />;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        return <CircularProgress size={16} sx={{ color: 'warning.main' }} />;
      case ConnectionState.FAILED:
        return <SyncProblem sx={{ color: 'error.main' }} fontSize="small" />;
      case ConnectionState.DISCONNECTED:
      default:
        return <WifiOff sx={{ color: 'text.secondary' }} fontSize="small" />;
    }
  };

  const getTooltipText = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return '已连接';
      case ConnectionState.CONNECTING:
        return '连接中...';
      case ConnectionState.RECONNECTING:
        return '重新连接中...';
      case ConnectionState.FAILED:
        return '连接失败 - 点击重试';
      case ConnectionState.DISCONNECTED:
      default:
        return '已断开连接';
    }
  };

  return (
    <Tooltip title={getTooltipText()}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: canManualReconnect ? 'pointer' : 'default',
          p: 0.5,
          borderRadius: 1,
          '&:hover': canManualReconnect ? {
            bgcolor: 'action.hover',
          } : {},
        }}
        onClick={canManualReconnect ? onManualReconnect : undefined}
      >
        {getStatusIcon()}
      </Box>
    </Tooltip>
  );
};