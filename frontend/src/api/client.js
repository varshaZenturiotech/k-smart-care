import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("ksmart_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const lang = localStorage.getItem("ksmart_language") || "en";
  config.headers["x-preferred-language"] = lang;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  config.headers["x-timezone"] = tz;

  return config;
});

export default client;

