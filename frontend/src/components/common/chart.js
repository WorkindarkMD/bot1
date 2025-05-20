// Импортируем адаптер в начале файла
import { convertForLightweightCharts } from './chartDataAdapter';

// В useEffect:
useEffect(() => {
  if (!chartContainerRef.current || !data) {
    return;
  }
  
  try {
    console.log('Инициализация графика с данными', data);
    setChartError(null);
    
    // Очистка предыдущего графика
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }
    
    // Используем адаптер для преобразования данных в формат Lightweight Charts
    let formattedData;
    
    // Проверяем формат входных данных
    if (data.candles) {
      // Если данные уже обработаны на сервере
      formattedData = convertForLightweightCharts(data.candles);
    } else {
      // Обрабатываем данные на стороне клиента
      formattedData = convertForLightweightCharts(data);
    }
    
    if (formattedData.length === 0) {
      console.warn('Нет форматированных данных для отображения графика');
      throw new Error('Нет данных для графика');
    }
    
    // Создаем график с обработанными данными
    const chartOptions = {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: 'solid', color: darkMode ? '#1F2937' : '#F9FAFB' },
        textColor: darkMode ? '#9CA3AF' : '#6B7280',
      },
      // ... остальные настройки
    };
    
    // Создаем график и применяем данные
    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;
    
    // Далее код создания и настройки графика
    
  } catch (error) {
    console.error('Ошибка при инициализации графика:', error);
    setChartError(error.message || 'Неизвестная ошибка инициализации графика');
  }
}, [data, darkMode, type, height, indicators, currentPair, interval]);