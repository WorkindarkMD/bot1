// App.js - Основной компонент приложения
import React, { useEffect, useState } from 'react';
import TradingPlatform from './components/TradingPlatform';
import useApi from './hooks/useApi';

// Компонент для инициализации приложения
const AppInitializer = () => {
  const api = useApi();
  const [connectionError, setConnectionError] = useState(true);
  const [initialized, setInitialized] = useState(true);
  const [initStatus, setInitStatus] = useState({
    system: true,
    settings: true,
    exchanges: true,
    pairs: true,
    websocket: true,
    chartData: true,
  });

  // Функция для проверки состояния соединения с сервером
  const checkServerConnection = async () => {
    try {
      const isConnected = await api.checkConnection();
      setConnectionError(!isConnected);
      return isConnected;
    } catch (error) {
      console.error("Ошибка при проверке соединения:", error);
      setConnectionError(true);
      return false;
    }
  };

  // Инициализация приложения при монтировании
  useEffect(() => {
    const initApp = async () => {
      try {
        // Сначала проверяем соединение с сервером
        const isConnected = await checkServerConnection();
        
        if (!isConnected) {
          console.error("Не удалось установить соединение с сервером. Попробуйте перезагрузить приложение.");
          return;
        }
        
        // Используем централизованную инициализацию всех данных
        const success = await api.initializeAppData();
        
        if (success) {
          console.log('Приложение успешно инициализировано');
          // Помечаем все статусы как загруженные
          setInitStatus({
            system: true,
            settings: true,
            exchanges: true,
            pairs: true,
            websocket: true,
            chartData: true
          });
          
          // Приложение готово к использованию
          setInitialized(true);
        } else {
          console.error('Не удалось инициализировать приложение');
        }
      } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        // Пробуем повторно проверить соединение
        await checkServerConnection();
      }
    };
    
    initApp();
    
    // Периодическая проверка соединения
    const connectionCheckInterval = setInterval(checkServerConnection, 60000); // каждые 60 секунд
    
    // Очистка при размонтировании
    return () => {
      clearInterval(connectionCheckInterval);
      
      // Отключаем WebSocket
      if (window.webSocketService) {
        window.webSocketService.disconnect();
      }
    };
  }, []);

  // Глобальный обработчик ошибок
  useEffect(() => {
    const handleGlobalError = (event) => {
      // Логируем ошибки, но не позволяем им остановить приложение
      console.error('Глобальная ошибка:', event.error);
      
      // Если это ошибка ресурсов, предотвращаем падение приложения
      if (event.message && event.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
        event.preventDefault();
        console.warn('Обнаружена ошибка нехватки ресурсов, приостанавливаем запросы на 5 секунд');
        // Глобальная пауза для всех запросов
        window._pauseAllRequests = true;
        setTimeout(() => {
          window._pauseAllRequests = false;
        }, 5000);
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  // Отображаем сообщение о проблеме с соединением
  if (connectionError) {
    return (
      <div className="connection-error-container">
        <div className="connection-error-message">
          <h2>Проблема с подключением к серверу</h2>
          <p>Не удается подключиться к серверу приложения. Возможные причины:</p>
          <ul>
            <li>Сервер не запущен</li>
            <li>Проблемы с сетевым соединением</li>
            <li>Несовместимость настроек CORS</li>
          </ul>
          <p>Проверьте следующее:</p>
          <ol>
            <li>Убедитесь, что сервер запущен на порту 4000</li>
            <li>Проверьте настройки брандмауэра</li>
            <li>Перезагрузите страницу</li>
          </ol>
          <button onClick={checkServerConnection} className="retry-button">
            Проверить соединение
          </button>
        </div>
      </div>
    );
  }

  // Показываем загрузочный экран до инициализации
  if (!initialized) {
    return (
      <div className="app-loading-container">
        <div className="app-loading-content">
          <h2>Загрузка приложения...</h2>
          <div className="loading-progress">
            {Object.entries(initStatus).map(([key, status]) => (
              <div key={key} className={`loading-item ${status ? 'loaded' : 'loading'}`}>
                {key}: {status ? '✓' : 'загрузка...'}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <TradingPlatform />;
};

// Основной компонент приложения
const App = () => {
  return <AppInitializer />;
};

export default App;