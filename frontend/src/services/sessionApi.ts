import { SessionInfo } from "../components/SessionList";
import { api } from "../config/api";

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
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  }

  private async handleResponse(response: Response): Promise<SessionResponse> {
    if (response.status === 401) {
      console.error("Authentication expired");
      // Clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Authentication expired. Please login again.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HTTP error:", response.status, response.statusText);
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}\nResponse: ${errorText}`
      );
    }

    const text = await response.text();

    try {
      const json = JSON.parse(text);
      return json;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      throw new Error(`Invalid JSON response from server: ${text}`);
    }
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    const url = api.url(api.endpoints.SESSIONS.LIST);
    const response = await fetch(url, {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch sessions");
    }

    // Validate the response data
    if (!Array.isArray(result.data)) {
      console.error("Invalid sessions response - expected array");
      return [];
    }

    return result.data || [];
  }

  async createSession(request: CreateSessionRequest): Promise<SessionInfo> {
    try {
      const url = api.url(api.endpoints.SESSIONS.CREATE);

      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      });

      const result = await this.handleResponse(response);

      if (!result.success) {
        throw new Error(result.error || "Failed to create session");
      }

      // Ensure all required fields are present
      const sessionData = result.data || result; // Fallback to result if data is not nested
      if (!sessionData.lastActivity) {
        sessionData.lastActivity =
          sessionData.createdAt || new Date().toISOString();
      }
      if (sessionData.connectedClients === undefined) {
        sessionData.connectedClients = 0;
      }

      return sessionData;
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(api.url(`/sessions/${sessionId}`), {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch session");
    }

    return result.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(api.url(api.endpoints.SESSIONS.DELETE(sessionId)), {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to delete session");
    }
  }

  async renameSession(sessionId: string, name: string): Promise<SessionInfo> {
    const response = await fetch(api.url(api.endpoints.SESSIONS.RENAME(sessionId)), {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to rename session");
    }

    return result.data;
  }

  async attachToSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(api.url(api.endpoints.SESSIONS.ATTACH), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ sessionId }),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to attach to session");
    }

    return result.data;
  }

  async getSessionOutput(sessionId: string, lines?: number): Promise<string[]> {
    const url = new URL(api.url(api.endpoints.SESSIONS.OUTPUT(sessionId)));
    if (lines) {
      url.searchParams.set("lines", lines.toString());
    }

    const response = await fetch(url.toString(), {
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse(response);

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch session output");
    }

    return result.data?.output || [];
  }
}

export const sessionApi = new SessionApiService();