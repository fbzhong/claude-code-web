import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { api as apiConfig } from "../config/api";

console.log("API: Using API_BASE =", apiConfig.baseUrl());

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: apiConfig.baseUrl(),
  timeout: 300000, // 5 minutes
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(
      `API ${config.method?.toUpperCase()} ${config.url}`,
      config.params || config.data
    );
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response || error);

    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
          break;
        case 403:
          console.error(
            "Forbidden: You do not have permission to access this resource"
          );
          break;
        case 404:
          console.error("Not Found: The requested resource does not exist");
          break;
        case 500:
          console.error("Server Error: An internal server error occurred");
          break;
      }
    }

    return Promise.reject(error);
  }
);

// Container operations
export const containerApi = {
  restart: async () => {
    const response = await api.post("/api/container/restart");
    return response.data;
  },
};

export default api;
