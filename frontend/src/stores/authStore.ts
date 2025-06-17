import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../config/api";

// Debug logger for mobile debugging
let debugLogger: any = null;
export const setDebugLogger = (logger: any) => {
  debugLogger = logger;
};

// Debug: Log the API_BASE URL
console.log("AuthStore: Using API_BASE =", api.baseUrl());

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    email: string,
    password: string,
    inviteCode?: string
  ) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        debugLogger?.logInfo("AUTH", `Starting login for ${email}`, {
          apiBase: api.baseUrl(),
        });

        try {
          const loginUrl = api.url(api.endpoints.AUTH.LOGIN);
          debugLogger?.logInfo("AUTH", "Making login request", {
            url: loginUrl,
          });

          const response = await fetch(loginUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          });

          const responseInfo = {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries()),
          };

          debugLogger?.logInfo("AUTH", "Login response received", responseInfo);

          const responseText = await response.text();
          debugLogger?.logInfo("AUTH", "Raw response received", {
            length: responseText.length,
            status: response.status,
          });

          let data;
          try {
            data = JSON.parse(responseText);
            debugLogger?.logSuccess("AUTH", "Response parsed successfully", {
              success: data.success,
            });
          } catch (parseError) {
            const errorMessage =
              parseError instanceof Error
                ? parseError.message
                : String(parseError);
            debugLogger?.logError("AUTH", "Failed to parse JSON response", {
              error: errorMessage,
              responseText: responseText.substring(0, 200),
            });
            throw new Error(`Invalid server response`);
          }

          if (!response.ok || !data.success) {
            debugLogger?.logError("AUTH", "Login failed", {
              status: response.status,
              error: data.error,
            });
            throw new Error(data.error || "Login failed");
          }

          const { token, user } = data.data;
          debugLogger?.logSuccess("AUTH", "Login successful", {
            email: user.email,
            tokenLength: token?.length,
          });

          // Store token in localStorage for other services
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));

          set({
            user,
            token,
            isAuthenticated: true,
          });

          debugLogger?.logSuccess("AUTH", "Auth store updated successfully");
        } catch (error) {
          const errorInfo =
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack?.substring(0, 500),
                }
              : {
                  name: "Unknown",
                  message: String(error),
                  stack: undefined,
                };
          debugLogger?.logError("AUTH", "Login failed", errorInfo);
          throw error;
        }
      },

      logout: () => {
        // Clear localStorage
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      register: async (email: string, password: string, inviteCode?: string) => {
        try {
          const response = await fetch(api.url(api.endpoints.AUTH.REGISTER), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
              ...(inviteCode && { inviteCode })
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "Registration failed");
          }

          const { token, user } = data.data;

          // Store token in localStorage for other services
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));

          set({
            user,
            token,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error("Registration failed:", error);
          throw error;
        }
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        // Restore token to localStorage on app load
        if (state?.token && state?.user) {
          localStorage.setItem("token", state.token);
          localStorage.setItem("user", JSON.stringify(state.user));
        }
      },
    }
  )
);
