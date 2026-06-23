import axios from "axios";

// When BACKEND_URL is empty (single-server build) we use relative URLs
// (same origin as the served React app). In dev/two-server mode the env
// var points to the external backend URL.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Er ging iets mis. Probeer het opnieuw.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const formatEUR = (n) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n || 0);

export const CATEGORIES = [
  "Frisdrank",
  "Non alcoholisch Bier",
  "Alcohol",
  "Snacks",
  "Eten",
];
