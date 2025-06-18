/**
 * Device ID generation and management
 * Generates a unique device identifier based on browser fingerprint
 */

const DEVICE_ID_KEY = 'claude-web-device-id';

/**
 * Get browser fingerprint components
 */
function getBrowserFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    // Add canvas fingerprint for more uniqueness
    getCanvasFingerprint(),
  ];
  
  return components.join('|');
}

/**
 * Generate canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Claude Web', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Claude Web', 4, 17);
    
    return canvas.toDataURL();
  } catch (e) {
    return 'canvas-error';
  }
}

/**
 * Generate SHA-256 hash with fallback
 */
async function sha256(text: string): Promise<string> {
  // Check if crypto.subtle is available (HTTPS required)
  if (window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hash = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('crypto.subtle failed, falling back to simple hash:', error);
    }
  }
  
  // Fallback: Simple hash function for non-HTTPS environments
  return simpleHash(text);
}

/**
 * Simple hash function fallback (djb2 algorithm)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  // Convert to positive number and then to hex
  const positiveHash = hash >>> 0;
  return positiveHash.toString(16).padStart(8, '0');
}

/**
 * Get or generate device ID
 */
export async function getDeviceId(): Promise<string> {
  // Check if device ID already exists
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate new device ID
    const fingerprint = getBrowserFingerprint();
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    
    // Combine all components and hash
    const combined = `${fingerprint}|${timestamp}|${random}`;
    deviceId = await sha256(combined);
    
    // Store in localStorage
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

/**
 * Clear device ID (for testing or logout)
 */
export function clearDeviceId(): void {
  localStorage.removeItem(DEVICE_ID_KEY);
}

/**
 * Get device info for debugging
 */
export function getDeviceInfo(): Record<string, any> {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
    timezone: new Date().getTimezoneOffset(),
    cores: navigator.hardwareConcurrency || 0,
    deviceId: localStorage.getItem(DEVICE_ID_KEY) || 'not-generated',
  };
}