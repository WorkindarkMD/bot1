import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
  TrendingUp, AlertCircle, Clock, Check, 
  Zap, RefreshCw, Filter, Layers, 
  Home
} from 'lucide-react';
import Card from '../common/Card';
import Loader from '../common/Loader';
import StatusBadge from '../common/StatusBadge';
import useApi from '../../hooks/useApi';
import useChart from '../../hooks/useChart';
import ApexChartComponent from '../common/ApexChartComponent';

const ChartContent = forwardRef((props, ref) => {
  // Создаем ref для графика
  const chartRef = useRef(null);
  
  // Получаем данные из Redux
  const currentPair = useSelector(state => state.currentPair);
  const interval = useSelector(state => state.interval);
  const darkMode = useSelector(state => state.darkMode !== false);
  
  // Используем хуки
  const { 
    fetchChartData,
    analyzeChart,
    fetchIndicators,
    toggleIndicator,
    fetchVisibleIndicatorsData,
    changeInterval
  } = useApi();
  
  // Использование хука с принудительным обновлением
  const { 
    chartData,
    isLoading, 
    error,
    refresh,
    forceRefresh,
    loadAllIndicatorsData
  } = useChart({
    autoLoad: true,
    autoRefresh: true,
    withVolume: true,
    indicators: [
      { type: 'ma', period: 20, color: '#3B82F6' },
      { type: 'ema', period: 50, color: '#8B5CF6' }
    ]
  });

  // Состояние
  const [activeIndicators, setActiveIndicators] = useState({
    mss: true,     // Market Structure Shift
    fvg: true,     // Fair Value Gap
    orderBlocks: true,  // Order Blocks
    stopHunt: true      // Stop Hunt Detector
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [indicatorsData, setIndicatorsData] = useState({});
  const [initialized, setInitialized] = useState(false);
  const [shouldUpdateIndicators, setShouldUpdateIndicators] = useState(false);

  // Загрузка данных индикаторов
  // Используем useCallback для оптимизации и предотвращения бесконечных циклов
  const loadIndicatorsData = useCallback(async () => {
    try {
      // Показываем, что начали загрузку
      console.log('Начинаем загрузку данных индикаторов...');
      
      // Проверяем, доступен ли API с учетом режима мока
      const isMockMode = !window.location.origin.includes(':4000') && !window.location.href.includes('/api/');
      
      if (isMockMode) {
        console.log('Режим мока для индикаторов, используем пустые данные');
        // Устанавливаем пустые данные индикаторов для демонстрации
        setIndicatorsData({
          mss: [],
          fvg: [],
          orderBlocks: [],
          stopHunt: []
        });
        return;
      }
      
      // Пробуем загрузить данные с API
      let data;
      try {
        data = await loadAllIndicatorsData();
      } catch (apiError) {
        console.warn('Не удалось получить данные индикаторов с API:', apiError);
        // В случае ошибки API устанавливаем пустые данные
        setIndicatorsData({});
        return;
      }
      
      // Проверяем, что получили данные
      if (!data) {
        console.warn('API вернул пустые данные индикаторов');
        setIndicatorsData({});
        return;
      }
      
      // Устанавливаем данные, если всё прошло успешно
      setIndicatorsData(data);
      console.log('Данные индикаторов успешно загружены:', Object.keys(data));
    } catch (error) {
      console.error('Критическая ошибка при загрузке данных индикаторов:', error);
      // В случае любой необработанной ошибки устанавливаем пустые данные
      setIndicatorsData({});
    }
  }, [loadAllIndicatorsData]); // Зависимость только от loadAllIndicatorsData
  
  // Первая инициализация после монтирования
  useEffect(() => {
    if (!initialized) {
      // Загружаем список индикаторов
      fetchIndicators();
      
      // Устанавливаем таймаут для принудительного обновления после первого рендеринга
      const timer = setTimeout(() => {
        console.log('Принудительное обновление после монтирования компонента');
        forceRefresh();
        setInitialized(true);
        setShouldUpdateIndicators(true); // Запланировать обновление индикаторов
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [initialized, forceRefresh, fetchIndicators]);
  
  // Эффект для загрузки индикаторов если пара или интервал изменились
  useEffect(() => {
    if (initialized) {
      // Запланировать обновление индикаторов после изменения пары или интервала
      setShouldUpdateIndicators(true);
    }
  }, [currentPair, interval, initialized]);
  
  // Отдельный эффект для обновления индикаторов, чтобы не создавать бесконечный цикл
  useEffect(() => {
    if (shouldUpdateIndicators) {
      loadIndicatorsData();
      setShouldUpdateIndicators(false); // Сбрасываем флаг после обновления
    }
  }, [shouldUpdateIndicators, loadIndicatorsData]);
  
  // Эффект для обработчика resize
  useEffect(() => {
    // Добавляем обработчик для события изменения размера окна
    const handleResize = () => {
      console.log('Изменение размера окна, обновляем график');
      if (chartRef.current && typeof chartRef.current.forceRender === 'function') {
        chartRef.current.forceRender();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Пустой массив зависимостей - только при монтировании

  // Переключение индикаторов
  const handleToggleIndicator = async (indicator) => {
    // Маппинг интерфейсных названий индикаторов в API идентификаторы
    const indicatorMap = {
      'mss': 'market-structure-shift',
      'fvg': 'fair-value-gap',
      'orderBlocks': 'order-block',
      'stopHunt': 'stop-hunt-detector'
    };

    // Получаем API-идентификатор индикатора
    const apiIndicatorId = indicatorMap[indicator] || indicator;
    
    // Проверяем, работаем ли в режиме мока (без реального API)
    const isMockMode = !window.location.origin.includes(':4000') && !window.location.href.includes('/api/');
    
    setActiveIndicators(prev => {
      const newValue = !prev[indicator];
      
      if (isMockMode) {
        console.log(`Режим мока: переключение индикатора ${indicator} -> ${newValue}`);
        // В режиме мока просто обновляем UI
        return {
          ...prev,
          [indicator]: newValue
        };
      }
      
      // В режиме с API вызываем метод toggleIndicator
      toggleIndicator(apiIndicatorId, newValue)
        .then(() => {
          // После успешного переключения запланируем обновление индикаторов
          setShouldUpdateIndicators(true);
        })
        .catch(error => {
          console.error(`Ошибка при переключении индикатора ${indicator}:`, error);
          // В случае ошибки все равно запланируем обновление данных
          setShouldUpdateIndicators(true);
        });
      
      return {
        ...prev,
        [indicator]: newValue
      };
    });
  };

  // Анализ графика
  const handleAnalyzeChart = () => {
    setIsAnalyzing(true);
    
    // Проверяем, работаем ли в режиме мока
    const isMockMode = !window.location.origin.includes(':4000') && !window.location.href.includes('/api/');
    
    if (isMockMode) {
      console.log('Режим мока: имитация анализа графика');
      // Имитируем задержку запроса
      setTimeout(() => {
        // Создаем демо-результат анализа
        const mockResult = {
          confidence: Math.floor(70 + Math.random() * 25), // 70-95%
          direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
          entryPoint: currentPair.includes('BTC') ? '42,350 - 42,420' : '2,850 - 2,890',
          stopLoss: currentPair.includes('BTC') ? '41,200' : '2,700',
          takeProfit1: currentPair.includes('BTC') ? '43,500' : '3,000',
          takeProfit2: currentPair.includes('BTC') ? '45,200' : '3,150',
          riskReward: '1:3.8'
        };
        
        setAnalysisResult(mockResult);
        setIsAnalyzing(false);
      }, 2000); // Имитация задержки в 2 секунды
      
      return;
    }
    
    // Вызов реального API
    analyzeChart({ pair: currentPair, interval })
      .then(result => {
        if (result) {
          setAnalysisResult(result);
        } else {
          // Если API вернул пустой результат, используем демо-данные
          console.warn('API вернул пустой результат анализа, используем демо-данные');
          setAnalysisResult(getAnalysisResult());
        }
      })
      .catch(error => {
        console.error('Ошибка при анализе графика:', error);
        // В случае ошибки используем демо-данные
        setAnalysisResult(getAnalysisResult());
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  };

  // Если нет ручного результата анализа, создаем демо-данные
  const getAnalysisResult = () => {
    if (analysisResult) return analysisResult;
    
    return {
      confidence: 89,
      direction: 'LONG',
      entryPoint: '42,350 - 42,420',
      stopLoss: '41,200',
      takeProfit1: '43,500',
      takeProfit2: '45,200',
      riskReward: '1:3.8'
    };
  };

  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({
    // Доступ к tradingViewRef для совместимости со старым кодом
    tradingViewRef: chartRef.current,
    
    // Метод для смены символа (если нужен доступ извне)
    changeSymbol: (symbol) => {
      if (chartRef.current && chartRef.current.getChartInstance) {
        // Здесь можно реализовать логику смены символа
        console.log('Changing symbol to', symbol);
      }
    },
    
    // Метод для смены интервала (если нужен доступ извне)
    changeInterval: (newInterval) => {
      if (chartRef.current && chartRef.current.getChartInstance) {
        // Здесь можно реализовать логику смены интервала
        console.log('Changing interval to', newInterval);
      }
    },
    
    // Метод для принудительного обновления
    forceRefresh: () => {
      console.log('Вызов forceRefresh через ref');
      forceRefresh();
    }
  }));

  // Обработчик для обновления графика
  const handleRefresh = () => {
    console.log('Запуск принудительного обновления графика');
    // Вызываем принудительное обновление данных
    forceRefresh();
    // Планируем обновление индикаторов после обновления графика
    setShouldUpdateIndicators(true);
  };

  // Далее идет JSX без изменений...
  
  return (
    // JSX остался без изменений
    // Обновленный фрагмент из ChartContent.jsx

// Область графика с предварительной проверкой DOM-элемента
<div className="flex-1 relative" style={{ minHeight: '300px' }}>
  {isLoading ? (
    <div className="h-full w-full flex justify-center items-center">
      <Loader size="lg" text="Загрузка данных графика..." />
    </div>
  ) : error ? (
    <div className="h-full w-full bg-gray-850 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={60} className="mx-auto text-red-500 mb-4" />
        <p className="text-xl text-gray-500">Ошибка при загрузке графика</p>
        <p className="text-gray-600 mt-2">{error}</p>
        <button 
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={handleRefresh}
        >
          Попробовать снова
        </button>
      </div>
    </div>
  ) : !chartData || chartData.length === 0 ? (
    <div className="h-full w-full bg-gray-850 flex items-center justify-center">
      <div className="text-center">
        <TrendingUp size={60} className="mx-auto text-gray-700 mb-4" />
        <p className="text-xl text-gray-500">Нет данных для отображения</p>
        <p className="text-gray-600 mt-2">Попробуйте выбрать другую торговую пару или интервал</p>
        <button 
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={handleRefresh}
        >
          Обновить данные
        </button>
      </div>
    </div>
  ) : (
    <div id="chart-container-wrapper" className="w-full h-full" style={{ minHeight: '300px' }}>
      <ApexChartComponent 
        ref={chartRef}
        data={chartData} 
        type="candlestick-volume"
        height="100%"
        indicators={[
          { type: 'ma', period: 20, color: '#3B82F6' },
          { type: 'ema', period: 50, color: '#8B5CF6' }
        ]}
        indicatorsData={indicatorsData}
      />
    </div>
  )}
  
  {/* Статус графика */}
  <div className="absolute top-4 left-4 z-10">
    <StatusBadge status={isLoading ? 'loading' : 'active'} />
  </div>
</div>
  );
});

export default ChartContent;