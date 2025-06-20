import React from 'react';
import { buildApiUrl } from '../config/api';

// 全局缓存，页面加载时读一次
let cachedRequireInviteCode: boolean | null = null;

const fetchRequireInviteCode = async (): Promise<boolean> => {
  if (cachedRequireInviteCode !== null) {
    return cachedRequireInviteCode;
  }

  try {
    const response = await fetch(buildApiUrl('/config'));
    if (!response.ok) {
      throw new Error('Failed to fetch config');
    }
    const config = await response.json();
    cachedRequireInviteCode = config.features?.authentication?.invite_code_required || false;
  } catch (err) {
    console.error('Failed to fetch config:', err);
    cachedRequireInviteCode = true; // 默认值
  }

  return cachedRequireInviteCode!; // 这里肯定不是 null
};

export const useRequireInviteCode = () => {
  const [requireInviteCode, setRequireInviteCode] = React.useState(cachedRequireInviteCode ?? true);
  const [loading, setLoading] = React.useState(cachedRequireInviteCode === null);

  React.useEffect(() => {
    if (cachedRequireInviteCode === null) {
      fetchRequireInviteCode().then((value) => {
        setRequireInviteCode(value);
        setLoading(false);
      });
    }
  }, []);

  return { requireInviteCode, loading, error: null };
};