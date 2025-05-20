import axios from 'axios';
import CONFIG from './config';

// Создание экземпляра axios с базовыми настройками
const apiClient = axios.create({
  baseURL: CONFIG.BASE_URL,
  timeout: CONFIG.TIMEOUT,
  headers: CONFIG.HEADERS
});

// Перехватчик запросов для добавления токена авторизации
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Перехватчик ответов для обработки ошибок
apiClient.interceptors.response.use(
  response => response.data,
  error => {
    // Обработка ошибок от API
    if (error.response) {
      console.error('API Error:', error.response.data);
      
      // Обработка 401 (Unauthorized)
      if (error.response.status === 401) {
        localStorage.removeItem('token');
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;