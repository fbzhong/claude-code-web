import { create } from "zustand";
import { persist } from "zustand/middleware";

// Debug logger for mobile debugging
let debugLogger: any = null;
export const setDebugLogger = (logger: any) => {
  debugLogger = logger;
};

const API_BASE =
  (() => {
    if (!process.env.REACT_APP_API_URL) {
      return "";
    }

    if (process.env.REACT_APP_API_SAME_HOST !== "true") {
      return process.env.REACT_APP_API_URL;
    }

    const apiUrl = new URL(process.env.REACT_APP_API_URL);
    const hrefUrl = new URL(window.location.href);

    return process.env.REACT_APP_API_URL.replace(
      apiUrl.hostname,
      hrefUrl.hostname
    );
  })() + "/api";

// Debug: Log the API_BASE URL
console.log("AuthStore: Using API_BASE =", API_BASE);

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        debugLogger?.logInfo("AUTH", `Starting login for ${username}`, {
          apiBase: API_BASE,
        });

        try {
          debugLogger?.logInfo("AUTH", "Making login request", {
            url: `${API_BASE}/auth/login`,
          });

          const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
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

          if (!response.ok) {
            const errorText = await response.text();
            const errorDetails = {
              status: response.status,
              statusText: response.statusText,
              body: errorText,
            };
            debugLogger?.logError("AUTH", "HTTP error response", errorDetails);
            throw new Error(
              `HTTP ${response.status}: ${response.statusText}\nResponse: ${errorText}`
            );
          }

          const responseText = await response.text();
          debugLogger?.logInfo("AUTH", "Raw response received", {
            length: responseText.length,
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
            throw new Error(`Invalid JSON response: ${responseText}`);
          }

          if (!data.success) {
            debugLogger?.logError("AUTH", "Server returned error", {
              error: data.error,
            });
            throw new Error(data.error || "Login failed");
          }

          const { token, user } = data.data;
          debugLogger?.logSuccess("AUTH", "Login successful", {
            username: user.username,
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

      register: async (username: string, email: string, password: string) => {
        try {
          const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              email,
              password,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          if (!data.success) {
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
