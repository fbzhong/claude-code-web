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

    const text = await response.text();
    console.log('handleResponse: Raw response text:', text);
    
    try {
      const json = JSON.parse(text);
      console.log('handleResponse: Parsed JSON:', json);
      return json;
    } catch (e) {
      console.error('handleResponse: Failed to parse JSON:', e);
      console.error('handleResponse: Raw text was:', text);
      throw new Error('Invalid JSON response from server');
    }
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    console.log('Fetching all sessions from:', `${API_BASE}/sessions`);
    const response = await fetch(`${API_BASE}/sessions`, {
      headers: this.getAuthHeaders()
    });

    const result = await this.handleResponse(response);
    console.log('getAllSessions raw response:', result);
    console.log('getAllSessions data type:', typeof result.data);
    console.log('getAllSessions data is array:', Array.isArray(result.data));
    console.log('getAllSessions data content:', JSON.stringify(result.data, null, 2));
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch sessions');
    }

    // Validate the response data
    if (!Array.isArray(result.data)) {
      console.error('Invalid sessions response - expected array, got:', typeof result.data, result.data);
      return [];
    }

    console.log('Returning sessions:', result.data.length, 'items');
    return result.data || [];
  }

  async createSession(request: CreateSessionRequest): Promise<SessionInfo> {
    console.log('sessionApi.createSession called with request:', request);
    
    try {
      console.log('sessionApi.createSession: Making fetch request to:', `${API_BASE}/sessions`);
      console.log('sessionApi.createSession: Headers:', this.getAuthHeaders());
      console.log('sessionApi.createSession: Body:', JSON.stringify(request));
      
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });
      
      console.log('sessionApi.createSession: Got response:', response);
      console.log('sessionApi.createSession: Response status:', response.status);
      console.log('sessionApi.createSession: Response ok:', response.ok);

      const result = await this.handleResponse(response);
      console.log('sessionApi.createSession: Parsed response:', result);
      console.log('sessionApi.createSession: result type:', typeof result);
      console.log('sessionApi.createSession: result keys:', Object.keys(result));
      console.log('sessionApi.createSession: result.success:', result.success);
      console.log('sessionApi.createSession: result.data:', result.data);
      console.log('sessionApi.createSession: result.data type:', typeof result.data);
      console.log('sessionApi.createSession: Full result stringified:', JSON.stringify(result));
      
      if (!result.success) {
        console.error('sessionApi.createSession: API returned error:', result.error);
        throw new Error(result.error || 'Failed to create session');
      }

      // Ensure all required fields are present
      const sessionData = result.data || result; // Fallback to result if data is not nested
      if (!sessionData.lastActivity) {
        sessionData.lastActivity = sessionData.createdAt || new Date().toISOString();
      }
      if (sessionData.connectedClients === undefined) {
        sessionData.connectedClients = 0;
      }

      console.log('sessionApi.createSession: Returning session data:', sessionData);
      return sessionData;
    } catch (error) {
      console.error('sessionApi.createSession: Caught error:', error);
      throw error;
    }
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