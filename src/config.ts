const host = typeof window !== "undefined" ? window.location.hostname : "";
export const API_BASE_URL = (host.includes("shumisphere.com") || host === "localhost" || host === "127.0.0.1")
  ? "" 
  : (import.meta.env.VITE_API_BASE_URL || "");
