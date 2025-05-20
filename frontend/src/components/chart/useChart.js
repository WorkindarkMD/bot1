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
  
  // Ссылки
  const chartRef = useRef(null);
  const wsSubscriptionRef = useRef(null);
  
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
        limit: params.limit || initialLimit
      };
      
      // Получаем данные через API
      const response = await fetch(`/api/chart?${new URLSearchParams(requestParams)}`);
      
      if (!response.ok) {
        throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
      }
      
      // Парсим ответ
      const data = await response.json();
      
      // Проверяем наличие данных
      if (!data || !data.candles || !Array.isArray(data.candles)) {
        throw new Error('Получены некорректные данные графика');
      }
      
      // Обновляем Redux Store
      if (!params.skipDispatch) {
        dispatch({ type: 'SET_CHART_DATA', payload: data.candles });
      }
      
      // Форматируем данные для графика
      const formatted = formatCandlesForApexCharts(data.candles);
      setFormattedData(formatted);
      
      // Сбрасываем состояние ошибки
      setError(null);
      
      // Возвращаем данные
      return data.candles;
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
      
      // Форматируем демо-данные для графика
      const formatted = formatCandlesForApexCharts(demoData);
      setFormattedData(formatted);
      
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
    let timerId = null;
    
    if (autoRefresh) {
      timerId = setInterval(() => {
        loadChartData({ silent: true });
      }, refreshInterval);
    }
    
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [loadChartData, autoRefresh, refreshInterval]);
  
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
    loadChartData();
  }, [loadChartData]);
  
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
    
    // Параметры
    currentPair,
    interval,
    withVolume,
    darkMode,
    
    // Методы
    loadChartData,
    refresh,
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