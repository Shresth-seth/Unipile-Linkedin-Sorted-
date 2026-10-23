import axios from "axios";

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    // If accessed via standard HTTP/HTTPS (port 80/443 through Nginx), use same origin
    if (!port || port === "80" || port === "443") {
      return `${protocol}//${hostname}`;
    }

    const envUrl = (
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      ""
    )
      .trim()
      .replace(/\/+$/, "");

    // If explicit non-localhost URL is provided in env, use it
    if (envUrl && !envUrl.includes("localhost")) {
      return envUrl;
    }

    // Otherwise dynamically resolve against current browser hostname on port 4000
    return `${protocol}//${hostname}:4000`;
  }

  return (
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  )
    .trim()
    .replace(/\/+$/, "");
};

const AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: rely on the HTTP-only session cookie.
AxiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    if (typeof window !== "undefined") {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz && !config.headers["x-timezone"]) {
          config.headers["x-timezone"] = tz;
        }
      } catch (e) {}
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor: Capture token and handle 401
AxiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (
      error.response &&
      error.response.status === 401 &&
      typeof window !== "undefined"
    ) {
      // If unauthorized on protected endpoint, do not crash
      console.warn("API 401 Unauthorized:", error.config?.url);
    }
    return Promise.reject(error);
  },
);

export default AxiosInstance;
