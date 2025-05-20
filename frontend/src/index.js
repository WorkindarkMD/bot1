// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './redux/store';
import App from './App';
import { NotificationProvider } from './components/common/Notification';
import './index.css';
console.log('=== ЗАПУСК ПРИЛОЖЕНИЯ: import загружен ===');

console.log('=== STORE ГОТОВ:', !!store, '===');

// Создаем корневой элемент
const root = ReactDOM.createRoot(document.getElementById('root'));
console.log('=== ROOT ЭЛЕМЕНТ СОЗДАН ===');

// Рендерим приложение с правильным порядком провайдеров
console.log('=== НАЧИНАЕМ РЕНДЕРИНГ ПРИЛОЖЕНИЯ ===');
root.render(
  // Отключаем StrictMode для отладки
  // <React.StrictMode>
    <Provider store={store}>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </Provider>
  // </React.StrictMode>
);
console.log('=== РЕНДЕРИНГ ИНИЦИИРОВАН ===');
