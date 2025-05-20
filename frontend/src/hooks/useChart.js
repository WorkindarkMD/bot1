// src/hooks/useChart.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { formatCandlesForApexCharts, generateDemoCandles } from '../utils/chartDataUtils';

/**
 * Хук для работы с данными графика
 * Предоставляет интерфейс для загрузки и обработки данных графика
 * 
 * @param {Object} config - Конфигурация хука
 * @returns {Object} - Методы и состояние для работы с графиком
 */
const useChart = (config = {}) => {
  const dispatch = useDispatch();
  
  // Получаем данные из Redux
  const currentPair = useSelector(state => state.currentPair);
  const interval = useSelector(state => state.interval);
  const chartData = useSelector(state => state.chartData);
  const isLoading = useSelector(state => state.isLoading);
  const darkMode = useSelector(state => state.darkMode !== false);
  
  // Локальное состояние
  const [formattedData, setFormattedData] = useState([]);
  const [error, setError] = useState(null);
  const [chartInstance, setChartInstance] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(0);
  
  // Ссылки
  const chartRef = useRef(null);
  const wsSubscriptionRef = useRef(null);
  const forceRefreshTimerRef = useRef(null);
  
  // Опции
  const { 
    autoLoad = true,
    autoRefresh = true,
    refreshInterval = 60000, // 1 минута
    initialLimit = 100,
    withVolume = true,
    indicators = []
  } = config;
  
  /**
   * Загрузка данных графика
   * @param {Object} params - Параметры запроса
   * @returns {Promise<Array>} - Данные графика
   */
  const loadChartData = useCallback(async (params = {}) => {
    // Устанавливаем состояние загрузки
    if (!params.silent) {
      dispatch({ type: 'SET_LOADING', payload: true });
    }
    
    try {
      // Подготавливаем параметры запроса
      const requestParams = {
        symbol: params.symbol || currentPair,
        interval: params.interval || interval,
        limit: params.limit || initialLimit,
        force: params.force || false
      };
      
      console.log(`Загрузка данных графика: ${requestParams.symbol}, ${requestParams.interval}${requestParams.force ? ' (принудительно)' : ''}`);
      
      // Получаем данные через API
      const response = await fetch(`/api/chart?${new URLSearchParams(requestParams)}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
      }
      
      // Парсим ответ
      const data = await response.json();
      
      // Проверяем наличие данных
      if (!data) {
        throw new Error('Получены пустые данные графика');
      }
      
      // Извлекаем массив свечей из разных возможных форматов ответа
      let candles = null;
      
      if (Array.isArray(data)) {
        // Если ответ уже массив свечей
        candles = data;
      } else if (data.candles && Array.isArray(data.candles)) {
        // Если ответ в формате {candles: [...]}
        candles = data.candles;
      } else if (data.data && Array.isArray(data.data)) {
        // Если ответ в формате {data: [...]}
        candles = data.data;
      } else {
        console.warn('Неизвестный формат данных графика:', data);
        throw new Error('Неизвестный формат данных графика');
      }
      
      if (!candles || candles.length === 0) {
        console.warn('Получен пустой массив свечей');
        throw new Error('Нет данных для отображения графика');
      }
      
      // Обновляем Redux Store
      if (!params.skipDispatch) {
        dispatch({ type: 'SET_CHART_DATA', payload: candles });
      }
      
      // Форматируем данные для графика
      const formatted = formatCandlesForApexCharts(candles);
      setFormattedData(formatted);
      
      // Обновляем время последнего обновления
      setLastRefresh(Date.now());
      
      // Сбрасываем состояние ошибки
      setError(null);
      
      console.log(`Данные графика успешно загружены: ${candles.length} свечей`);
      
      // Возвращаем данные
      return candles;
    } catch (error) {
      console.error('Ошибка при загрузке данных графика:', error);
      
      // Устанавливаем состояние ошибки
      setError(error.message || 'Неизвестная ошибка при загрузке данных');
      
      // Генерируем демо-данные
      const demoData = generateDemoCandles(
        params.symbol || currentPair,
        params.interval || interval,
        params.limit || initialLimit
      );
      
      console.log(`Сгенерированы демо-данные: ${demoData.length} свечей`);
      
      // Обновляем Redux Store с демо-данными
      if (!params.skipDispatch) {
        dispatch({ type: 'SET_CHART_DATA', payload: demoData });
      }
      
      // Форматируем демо-данные для графика
      const formatted = formatCandlesForApexCharts(demoData);
      setFormattedData(formatted);
      
      // Обновляем время последнего обновления
      setLastRefresh(Date.now());
      
      // Возвращаем демо-данные
      return demoData;
    } finally {
      // Сбрасываем состояние загрузки
      if (!params.silent) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  }, [currentPair, dispatch, initialLimit, interval]);
  
  /**
   * Обработчик обновления свечи
   * @param {Object} update - Данные обновления свечи
   */
  const handleCandleUpdate = useCallback((update) => {
    if (!chartInstance || !update) return;
    
    try {
      // Преобразование данных свечи в формат ApexCharts
      const candleData = formatCandlesForApexCharts([update])[0];
      
      // Получение текущих данных графика
      const currentSeries = chartInstance.w.config.series[0].data;
      
      // Поиск свечи с тем же временем
      const existingIndex = currentSeries.findIndex(candle => 
        new Date(candle.x).getTime() === new Date(candleData.x).getTime()
      );
      
      // Обновление данных графика
      const updatedSeries = [...currentSeries];
      
      if (existingIndex >= 0) {
        // Обновляем существующую свечу
        updatedSeries[existingIndex] = candleData;
      } else {
        // Добавляем новую свечу
        updatedSeries.push(candleData);
        // Сортируем по времени
        updatedSeries.sort((a, b) => new Date(a.x) - new Date(b.x));
      }
      
      // Обновляем график
      chartInstance.updateSeries([{
        name: currentPair,
        type: 'candlestick',
        data: updatedSeries
      }]);
    } catch (error) {
      console.error('Ошибка при обновлении свечи:', error);
    }
  }, [chartInstance, currentPair]);
  
  /**
   * Подписка на обновления через WebSocket
   */
  const subscribeToUpdates = useCallback(() => {
    // Отписываемся от предыдущей подписки, если она есть
    if (wsSubscriptionRef.current) {
      wsSubscriptionRef.current();
      wsSubscriptionRef.current = null;
    }
    
    // Проверяем доступность WebSocket сервиса
    if (!window.webSocketService) {
      console.warn('WebSocket сервис недоступен');
      return;
    }
    
    // Подписываемся на обновления графика
    wsSubscriptionRef.current = window.webSocketService.subscribeToChart(
      currentPair,
      interval,
      handleCandleUpdate
    );
    
    // Логируем успешную подписку
    console.log(`Подписка на обновления графика: ${currentPair} (${interval})`);
  }, [currentPair, interval, handleCandleUpdate]);
  
  /**
   * Обновление графика через интервал
   */
  useEffect(() => {
    let rafId = null;
    
    if (autoRefresh) {
      // Используем requestAnimationFrame вместо setInterval для лучшей производительности
      const scheduleRefresh = () => {
        const now = Date.now();
        if (now - lastRefresh >= refreshInterval) {
          loadChartData({ silent: true });
          setLastRefresh(now);
        }
        
        rafId = window.requestAnimationFrame(scheduleRefresh);
      };
      
      rafId = window.requestAnimationFrame(scheduleRefresh);
    }
    
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [loadChartData, autoRefresh, refreshInterval, lastRefresh]);
  
  /**
   * Загрузка данных при изменении пары или интервала
   */
  useEffect(() => {
    if (autoLoad) {
      loadChartData();
    }
  }, [currentPair, interval, loadChartData, autoLoad]);
  
  /**
   * Преобразование данных при изменении chartData
   */
  useEffect(() => {
    if (chartData && Array.isArray(chartData) && chartData.length > 0) {
      const formatted = formatCandlesForApexCharts(chartData);
      setFormattedData(formatted);
      setError(null);
    }
  }, [chartData]);
  
  /**
   * Подписка на обновления при изменении параметров
   */
  useEffect(() => {
    if (autoRefresh) {
      subscribeToUpdates();
    }
    
    return () => {
      if (wsSubscriptionRef.current) {
        wsSubscriptionRef.current();
        wsSubscriptionRef.current = null;
      }
    };
  }, [currentPair, interval, subscribeToUpdates, autoRefresh]);
  
  /**
   * Получение данных индикатора
   * @param {string} id - Идентификатор индикатора
   * @returns {Promise<Object>} - Данные индикатора
   */
  const loadIndicatorData = useCallback(async (id) => {
    try {
      // Запрос к API для получения данных индикатора
      const response = await fetch(`/api/chart/indicator/${id}?symbol=${currentPair}&interval=${interval}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
      }
      
      // Парсим ответ
      const data = await response.json();
      
      // Проверяем наличие данных
      if (!data || !data.visualData) {
        throw new Error('Получены некорректные данные индикатора');
      }
      
      return data.visualData;
    } catch (error) {
      console.error(`Ошибка при загрузке данных индикатора ${id}:`, error);
      return null;
    }
  }, [currentPair, interval]);
  
  /**
   * Загрузка данных всех видимых индикаторов
   * @returns {Promise<Object>} - Данные индикаторов
   */
  const loadAllIndicatorsData = useCallback(async () => {
    try {
      // Запрос к API для получения данных всех видимых индикаторов
      const response = await fetch(`/api/chart/indicators/visible?symbol=${currentPair}&interval=${interval}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
      }
      
      // Парсим ответ
      const data = await response.json();
      
      // Проверяем наличие данных
      if (!data || !data.visualData) {
        throw new Error('Получены некорректные данные индикаторов');
      }
      
      return data.visualData;
    } catch (error) {
      console.error('Ошибка при загрузке данных индикаторов:', error);
      return {};
    }
  }, [currentPair, interval]);
  
  /**
   * Изменение торговой пары
   * @param {string} pair - Новая торговая пара
   */
  const changePair = useCallback((pair) => {
    if (pair === currentPair) return;
    
    dispatch({ type: 'SET_TRADING_PAIR', payload: pair });
    
    // Отправляем запрос к API для изменения пары в бэкенде (опционально)
    fetch('/api/chart/symbol', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol: pair })
    }).catch(error => {
      console.error('Ошибка при изменении пары:', error);
    });
  }, [currentPair, dispatch]);
  
  /**
   * Изменение интервала
   * @param {string} newInterval - Новый интервал
   */
  const changeInterval = useCallback((newInterval) => {
    if (newInterval === interval) return;
    
    dispatch({ type: 'SET_INTERVAL', payload: newInterval });
    
    // Отправляем запрос к API для изменения интервала в бэкенде (опционально)
    fetch('/api/chart/interval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ interval: newInterval })
    }).catch(error => {
      console.error('Ошибка при изменении интервала:', error);
    });
  }, [interval, dispatch]);
  
  /**
   * Обновление данных графика
   */
  const refresh = useCallback(() => {
    console.log('Обновление данных графика...');
    loadChartData();
  }, [loadChartData]);
  
  /**
   * Принудительное обновление графика с очисткой данных
   * Улучшенная версия с таймаутами для более надежной инициализации
   */
  const forceRefresh = useCallback(() => {
    console.log('Принудительное обновление графика...');
    
    // Очищаем существующий таймер, если он есть
    if (forceRefreshTimerRef.current) {
      clearTimeout(forceRefreshTimerRef.current);
      forceRefreshTimerRef.current = null;
    }
    
    // Очищаем данные, чтобы вызвать перерисовку графика
    setFormattedData([]);
    
    // Оповещаем Redux о сбросе данных
    dispatch({ type: 'SET_CHART_DATA', payload: [] });
    
    // Первая фаза: загрузка данных с небольшой задержкой
    forceRefreshTimerRef.current = setTimeout(() => {
      console.log('Фаза 1: Загрузка данных с принудительным режимом');
      // Загружаем данные с принудительным режимом
      loadChartData({ force: true })
        .then(() => {
          // Вторая фаза: вызов принудительного рендеринга компонента с дополнительной задержкой
          forceRefreshTimerRef.current = setTimeout(() => {
            console.log('Фаза 2: Принудительная инициализация графика');
            if (chartRef.current && typeof chartRef.current.forceRender === 'function') {
              console.log('Вызываем принудительную инициализацию графика через ref...');
              chartRef.current.forceRender();
            } else if (chartRef.current) {
              console.log('Принудительный ререндер компонента графика');
              // Альтернативный вариант, если метод forceRender недоступен
              const event = new CustomEvent('force-rerender');
              window.dispatchEvent(event);
            }
            
            forceRefreshTimerRef.current = null;
          }, 500); // Увеличенная задержка для гарантии обновления DOM
        })
        .catch(err => {
          console.error('Ошибка при загрузке данных для принудительного обновления:', err);
          forceRefreshTimerRef.current = null;
        });
    }, 300);
  }, [loadChartData, dispatch]);
  
  /**
   * Установка экземпляра графика
   * @param {Object} instance - Экземпляр ApexCharts
   */
  const setChart = useCallback((instance) => {
    setChartInstance(instance);
  }, []);
  
  return {
    // Состояние
    chartData: formattedData, // Форматированные данные для ApexCharts
    rawData: chartData, // Исходные данные
    isLoading,
    error,
    chartInstance,
    chartRef,
    lastRefresh,
    
    // Параметры
    currentPair,
    interval,
    withVolume,
    darkMode,
    
    // Методы
    loadChartData,
    refresh,
    forceRefresh, // Улучшенный метод для принудительного обновления
    changePair,
    changeInterval,
    subscribeToUpdates,
    handleCandleUpdate,
    loadIndicatorData,
    loadAllIndicatorsData,
    setChart
  };
};

export default useChart;