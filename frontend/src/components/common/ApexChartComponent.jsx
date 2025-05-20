import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import ApexCharts from 'apexcharts';

const ApexChartComponent = forwardRef(({ 
  data, 
  type = 'candlestick',
  height = 400, 
  indicators = [],
  indicatorsData = {}
}, ref) => {
  const darkMode = useSelector(state => state.darkMode !== false);
  const currentPair = useSelector(state => state.currentPair || 'BTC/USDT');
  const interval = useSelector(state => state.interval || '1H');
  
  const [series, setSeries] = useState([]);
  const [options, setOptions] = useState({});
  const [chartError, setChartError] = useState(null);
  const [isRealtimeMode, setIsRealtimeMode] = useState(true);
  const [chartInstance, setChartInstance] = useState(null); 
  const chartContainerRef = useRef(null);
  const [containerReady, setContainerReady] = useState(false);
  const [renderAttempts, setRenderAttempts] = useState(0);
  const maxRenderAttempts = 5;
  
  // DEBUG - Log the data being received
  useEffect(() => {
    console.log('ApexChartComponent received data:', data);
    console.log('Data type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    if (Array.isArray(data) && data.length > 0) {
      console.log('First item:', data[0]);
    }
  }, [data]);
  
  // Проверяем готовность DOM-контейнера
  useLayoutEffect(() => {
    // Функция проверки готовности контейнера
    const checkContainerReadiness = () => {
      if (!chartContainerRef.current) {
        console.log('DOM контейнер для графика не существует');
        return false;
      }
      
      console.log('Проверка DOM контейнера, размеры:', 
                 chartContainerRef.current.offsetWidth, 
                 chartContainerRef.current.offsetHeight);
      
      return chartContainerRef.current.offsetWidth > 0 && 
             chartContainerRef.current.offsetHeight > 0;
    };
    
    // Проверяем состояние контейнера
    if (checkContainerReadiness()) {
      console.log('DOM контейнер готов к рендерингу');
      setContainerReady(true);
      return;
    }
    
    // Если контейнер не готов, настраиваем интервал для проверки
    console.log('DOM контейнер не готов, настраиваем проверку...');
    
    const checkInterval = setInterval(() => {
      if (checkContainerReadiness()) {
        console.log('DOM контейнер стал готов к рендерингу');
        setContainerReady(true);
        clearInterval(checkInterval);
      }
    }, 100);
    
    // MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver((mutations) => {
      if (checkContainerReadiness()) {
        console.log('DOM контейнер стал готов после изменений DOM');
        setContainerReady(true);
        observer.disconnect();
        clearInterval(checkInterval);
      }
    });
    
    // Наблюдаем за изменениями в DOM
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current, {
        attributes: true,
        childList: true,
        subtree: true
      });
    }
    
    // Глобальный обработчик для форсированного обновления
    const handleForceRerender = () => {
      console.log('Получено событие force-rerender');
      setRenderAttempts(0); // Сбрасываем счетчик попыток
      if (chartInstance) {
        console.log('Уничтожаем существующий экземпляр графика');
        chartInstance.destroy();
        setChartInstance(null);
      }
      
      // Установка контейнера готовым к использованию
      if (checkContainerReadiness()) {
        setContainerReady(true);
      }
    };
    
    window.addEventListener('force-rerender', handleForceRerender);
    
    return () => {
      clearInterval(checkInterval);
      observer.disconnect();
      window.removeEventListener('force-rerender', handleForceRerender);
    };
  }, [chartInstance]);
  
  // Функция для форсированного повторного рендеринга
  const forceRender = () => {
    console.log('Вызван метод forceRender, сбрасываем состояние графика');
    if (chartInstance) {
      chartInstance.destroy();
    }
    setChartInstance(null);
    setRenderAttempts(0);
    setContainerReady(chartContainerRef.current && 
                      chartContainerRef.current.offsetWidth > 0 && 
                      chartContainerRef.current.offsetHeight > 0);
  };
  
  // Экспортируем метод forceRender через ref
  useImperativeHandle(ref, () => ({
    forceRender,
    updateCandle: (candleData) => {
      if (!chartInstance) return;
      
      const timestamp = candleData.time || Math.floor(candleData.openTime / 1000);
      const jsTimestamp = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
      
      const candleUpdate = {
        x: new Date(jsTimestamp),
        y: [
          parseFloat(candleData.open),
          parseFloat(candleData.high),
          parseFloat(candleData.low),
          parseFloat(candleData.close)
        ]
      };
      
      // Получаем текущие серии
      const currentSeries = chartInstance.w.config.series[0].data;
      
      // Ищем свечу с таким же временем
      const existingIndex = currentSeries.findIndex(candle => 
        new Date(candle.x).getTime() === candleUpdate.x.getTime()
      );
      
      // Создаем новую серию данных
      const updatedSeries = [...currentSeries];
      
      if (existingIndex >= 0) {
        // Обновляем существующую свечу
        updatedSeries[existingIndex] = candleUpdate;
      } else {
        // Добавляем новую свечу
        updatedSeries.push(candleUpdate);
        // Сортируем по времени
        updatedSeries.sort((a, b) => new Date(a.x) - new Date(b.x));
      }
      
      // Обновляем график
      chartInstance.updateSeries([{
        name: currentPair,
        type: 'candlestick',
        data: updatedSeries
      }]);
    },
    setRealtimeMode: (mode) => {
      setIsRealtimeMode(mode);
    },
    getChartInstance: () => chartInstance
  }));
  
  // Преобразование данных для ApexCharts
  const formatChartData = (rawData) => {
    try {
      if (!rawData) {
        console.error('Нет данных для отображения графика', rawData);
        throw new Error('Нет данных для отображения графика');
      }
      
      // Конвертируем в правильный формат, если нужно
      let dataArray = rawData;
      
      if (!Array.isArray(rawData)) {
        console.log('Данные не являются массивом, пытаемся извлечь массив');
        // Проверяем наличие свойства candles
        if (rawData.candles && Array.isArray(rawData.candles)) {
          dataArray = rawData.candles;
          console.log('Извлечен массив из свойства candles:', dataArray.length);
        } else if (rawData.data && Array.isArray(rawData.data)) {
          dataArray = rawData.data;
          console.log('Извлечен массив из свойства data:', dataArray.length);
        } else {
          console.error('Не удалось извлечь массив данных из объекта:', rawData);
          throw new Error('Неверный формат данных: не удалось найти массив');
        }
      }
      
      if (dataArray.length === 0) {
        console.error('Массив данных пуст');
        throw new Error('Нет данных для отображения графика (пустой массив)');
      }
      
      console.log('Форматирование данных для ApexCharts, получены данные:', dataArray.length);
      setChartError(null);
      
      // Форматирование данных для свечного графика
      const formattedCandles = [];
      
      let candles = dataArray;
      
      // Создаем форматированные данные для ApexCharts
      candles.forEach(item => {
        if (!item) return;
        
        // Определяем метку времени и OHLC значения
        let timestamp;
        let open, high, low, close, volume;
        
        if (Array.isArray(item)) {
          // Обработка формата массива [timestamp, open, high, low, close, volume]
          timestamp = parseInt(item[0]);
          open = parseFloat(item[1] || 0);
          high = parseFloat(item[2] || 0);
          low = parseFloat(item[3] || 0);
          close = parseFloat(item[4] || 0);
          volume = parseFloat(item[5] || 0);
          
          console.log(`Обработка свечи в формате массива: [${timestamp}, ${open}, ${high}, ${low}, ${close}, ${volume}]`);
        } else {
          // Обработка формата объекта { time, open, high, low, close, volume }
          timestamp = parseInt(item.time || item.openTime);
          open = parseFloat(item.open || 0);
          high = parseFloat(item.high || 0);
          low = parseFloat(item.low || 0);
          close = parseFloat(item.close || 0);
          volume = parseFloat(item.volume || 0);
          
          console.log(`Обработка свечи в формате объекта: { time: ${timestamp}, open: ${open}, high: ${high}, low: ${low}, close: ${close}, volume: ${volume} }`);
        }
        
        // Преобразуем метку времени в объект Date
        const jsTimestamp = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
        const date = new Date(jsTimestamp);
        
        // Добавляем свечу в массив форматированных данных
        formattedCandles.push({
          x: date,
          y: [open, high, low, close]
        });
      });
      
      // Устанавливаем серии данных
      setSeries([{ name: currentPair, data: formattedCandles }]);
      
      // Устанавливаем опции графика
      setOptions({
        chart: {
          type: type,
          height: height,
          animations: {
            enabled: isRealtimeMode
          }
        },
        series: [{
          name: currentPair,
          data: formattedCandles
        }],
        xaxis: {
          type: 'datetime'
        },
        yaxis: {
          tooltip: {
            enabled: true
          }
        },
        theme: {
          mode: darkMode ? 'dark' : 'light'
        },
        markers: {
          size: 0
        },
        tooltip: {
          shared: true,
          intersect: false,
          x: {
            format: 'dd MMM yyyy HH:mm:ss'
          }
        },
        plotOptions: {
          candlestick: {
            colors: {
              upward: '#3C90EB',
              downward: '#DF7D46'
            }
          }
        },
        grid: {
          borderColor: darkMode ? '#4b5563' : '#e5e7eb'
        },
        stroke: {
          curve: 'stepline'
        },
        legend: {
          show: true,
          position: 'top',
          horizontalAlign: 'left'
        },
        annotations: {
          yaxis: indicators.map(indicator => ({
            y: indicator.value,
            borderColor: indicator.color,
            label: {
              text: indicator.label,
              style: {
                color: '#fff',
                background: indicator.color
              }
            }
          })),
          xaxis: []
        }
      });
    } catch (error) {
      console.error('Ошибка при форматировании данных для ApexCharts:', error);
      setChartError(error.message);
    }
  };
  
  // Рендеринг графика
  useEffect(() => {
    if (!containerReady || renderAttempts >= maxRenderAttempts) return;
    
    try {
      if (chartInstance) {
        console.log('Обновление существующего экземпляра графика');
        chartInstance.updateOptions(options);
        chartInstance.updateSeries(series);
      } else {
        console.log('Создание нового экземпляра графика');
        const newChartInstance = new ApexCharts(chartContainerRef.current, {
          ...options,
          series: series
        });
        newChartInstance.render();
        setChartInstance(newChartInstance);
      }
    } catch (error) {
      console.error('Ошибка при рендеринге графика:', error);
      setChartError(error.message);
      setRenderAttempts(renderAttempts + 1);
    }
  }, [containerReady, options, series, renderAttempts]);
  
  // Обработка ошибок
  useEffect(() => {
    if (chartError) {
      console.error('Произошла ошибка при работе с графиком:', chartError);
      // Здесь можно добавить дополнительную обработку ошибок, например, отображение сообщения пользователю
    }
  }, [chartError]);
  
  // Обновление данных графика при изменении входных данных
  useEffect(() => {
    console.log('Обновление данных графика');
    formatChartData(data);
  }, [data]);
  
  return (
    <div>
      {chartError && <div className="chart-error">{chartError}</div>}
      <div ref={chartContainerRef} id="chart"></div>
    </div>
  );
});

export default ApexChartComponent;