import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE = (() => {
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
})();

console.log("API: Using API_BASE =", API_BASE);

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`API ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
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
    console.error('API Response Error:', error.response || error);
    
    // Handle common errors
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized - redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          break;
        case 403:
          console.error('Forbidden: You do not have permission to access this resource');
          break;
        case 404:
          console.error('Not Found: The requested resource does not exist');
          break;
        case 500:
          console.error('Server Error: An internal server error occurred');
          break;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;