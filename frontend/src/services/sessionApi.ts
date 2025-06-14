import { SessionInfo } from '../components/SessionList';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:12021/api';

// Debug: Log the API_BASE URL
console.log('SessionAPI: Using API_BASE =', API_BASE);

export interface CreateSessionRequest {
  name?: string;
  workingDir?: string;
  environment?: Record<string, string>;
}

export interface SessionResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

class SessionApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    console.log('SessionAPI using token:', token ? 'present' : 'missing');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  private async handleResponse(response: Response): Promise<SessionResponse> {
    if (response.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Authentication expired. Please login again.');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    const response = await fetch(`${API_BASE}/sessions`, {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch sessions');
    }

    return result.data || [];
  }

  async createSession(request: CreateSessionRequest): Promise<SessionInfo> {
    console.log('Creating session with request:', request);
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    const result = await this.handleResponse(response);
    console.log('Create session response:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create session');
    }

    return result.data;
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch session');
    }

    return result.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete session');
    }
  }

  async renameSession(sessionId: string, name: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name })
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to rename session');
    }

    return result.data;
  }

  async attachToSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/sessions/attach`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ sessionId })
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to attach to session');
    }

    return result.data;
  }

  async getSessionOutput(sessionId: string, lines?: number): Promise<string[]> {
    const url = new URL(`${API_BASE}/sessions/${sessionId}/output`);
    if (lines) {
      url.searchParams.set('lines', lines.toString());
    }

    const response = await fetch(url.toString(), {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse(response);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch session output');
    }

    return result.data?.output || [];
  }
}

export const sessionApi = new SessionApiService();