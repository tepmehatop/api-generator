import axios from 'axios';

/**
 * HTTP клиент для API запросов
 */
export const httpClient = axios.create({
  baseURL: process.env.STAND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для добавления токена авторизации
httpClient.interceptors.request.use(
  (config) => {
    const token = process.env.AUTH_TOKEN;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor для обработки ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Устанавливает кастомный токен для всех последующих запросов
 * @param token - Токен авторизации или null для удаления токена
 */
export function setAuthToken(token: string | null) {
  if (token === null) {
    delete httpClient.defaults.headers.common['Authorization'];
  } else {
    httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

/**
 * Выполняет запрос с переопределенным токеном (одноразово)
 * @param config - Конфигурация axios
 * @param token - Токен авторизации или null для запроса без токена
 */
export async function requestWithToken<T = any>(
  config: any,
  token: string | null = null
) {
  const customConfig = { ...config };
  if (token === null) {
    customConfig.headers = { ...customConfig.headers, Authorization: undefined };
  } else {
    customConfig.headers = { ...customConfig.headers, Authorization: `Bearer ${token}` };
  }
  return httpClient.request<T>(customConfig);
}