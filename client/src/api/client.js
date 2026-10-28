import axios from 'axios';

// Relative base URL: Vite proxies /api in development, the Express server serves it in production.
const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 20000 });

api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config?.url?.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
  return Promise.reject(e);
});

export const errMsg = (e) => e?.response?.data?.message
  || (!e?.response ? 'Cannot reach the server. Is the backend running?' : e?.message || 'Something went wrong');
export const errCode = (e) => e?.response?.data?.details?.code;
export default api;
