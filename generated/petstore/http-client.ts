import axios from 'axios';

/**
 * HTTP клиент для API запросов
 */
export const httpClient = axios.create({
  baseURL: 'https://petstore.swagger.io/v2',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для обработки ошибок
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
