// src/components/common/ChartComponent.js
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useSelector } from 'react-redux';
import { createChart } from 'lightweight-charts';

const ChartComponent = forwardRef(({ 
  data, 
  type = 'candlestick',
  height = 400, 
  indicators = [],
  indicatorsData = {}
}, ref) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsSubscriptionRef = useRef(null);
  const darkMode = useSelector(state => state.darkMode !== false);
  const currentPair = useSelector(state => state.currentPair || 'BTC/USDT');
  const interval = useSelector(state => state.interval || '1H');
  const chartStatus = useSelector(state => state.chartStatus);
  const [chartError, setChartError] = useState(null);
  const [isRealtimeMode, setIsRealtimeMode] = useState(true);
  // Функция для преобразования объекта времени в unix timestamp
  const convertTimeObjectToTimestamp = (timeObj) => {
    // Если timeObj уже число, просто возвращаем его (с конвертацией из мс в сек при необходимости)
    if (typeof timeObj === 'number') {
      return timeObj > 1000000000000 ? Math.floor(timeObj / 1000) : timeObj;
    }
    
    // Если это объект с датой
    if (timeObj && typeof timeObj === 'object') {
      // Если это объект с полями year, month, day
      if (timeObj.year && timeObj.month && timeObj.day) {
        // Месяцы в JavaScript начинаются с 0 (январь - 0, декабрь - 11)
        const date = new Date(timeObj.year, timeObj.month - 1, timeObj.day);
        return Math.floor(date.getTime() / 1000);
      }
      
      // Если это объект Date
      if (timeObj instanceof Date) {
        return Math.floor(timeObj.getTime() / 1000);
      }
      
      // Если это другой тип объекта со временем
      if (timeObj.timestamp) {
        return typeof timeObj.timestamp === 'number' ? 
          (timeObj.timestamp > 1000000000000 ? Math.floor(timeObj.timestamp / 1000) : timeObj.timestamp) : 
          Math.floor(Date.now() / 1000);
      }
      
      // Если это объект со временем в другом формате
      if (timeObj.unixtime || timeObj.unix || timeObj.time) {
        const timeValue = timeObj.unixtime || timeObj.unix || timeObj.time;
        return typeof timeValue === 'number' ? 
          (timeValue > 1000000000000 ? Math.floor(timeValue / 1000) : timeValue) : 
          Math.floor(Date.now() / 1000);
      }
    }
    
    // Если это строка, пробуем преобразовать ее в timestamp
    if (typeof timeObj === 'string') {
      const timestamp = Date.parse(timeObj) / 1000;
      return isNaN(timestamp) ? Math.floor(Date.now() / 1000) : timestamp;
    }
    
    // Если ничего не сработало, используем текущее время
    return Math.floor(Date.now() / 1000);
  };
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
     candleSeriesRef.current = null;
    }
    
    // Проверяем и адаптируем входные данные
    let candles = data;
    
    // Если данные пришли в формате { candles: [...] }
    if (data && data.candles && Array.isArray(data.candles)) {
      candles = data.candles;
    }
    
    // Форматирование данных для графика
    const formattedData = [];
    
    if (Array.isArray(candles)) {
      for (let i = 0; i < candles.length; i++) {
        const item = candles[i];
        if (!item) continue;
        
        // Определяем метку времени и переменные OHLCV
        let timestamp;
        let open, high, low, close, volume;
        
        if (Array.isArray(item)) {
          // Обработка формата массива [timestamp, open, high, low, close, volume]
          timestamp = item[0] ? convertTimeObjectToTimestamp(item[0]) : null;
          open = parseFloat(item[1] || 0);
          high = parseFloat(item[2] || 0);
          low = parseFloat(item[3] || 0);
          close = parseFloat(item[4] || 0);
          volume = parseFloat(item[5] || 0);
        } else {
          // Обработка формата объекта
          if (typeof item.openTime !== 'undefined') {
            timestamp = convertTimeObjectToTimestamp(item.openTime);
          } else if (typeof item.time !== 'undefined') {
            timestamp = convertTimeObjectToTimestamp(item.time);
          } else {
            continue; // Пропускаем элемент без времени
          }
          
          open = parseFloat(item.open || 0);
          high = parseFloat(item.high || 0);
          low = parseFloat(item.low || 0);
          close = parseFloat(item.close || 0);
          volume = parseFloat(item.volume || 0);
        }
        
        // Защита от NaN значений после parseFloat
        if (isNaN(open)) open = 0;
        if (isNaN(high)) high = 0;
        if (isNaN(low)) low = 0;
        if (isNaN(close)) close = 0;
        if (isNaN(volume)) volume = 0;
        
        // Пропускаем невалидные записи со всеми нулевыми значениями
        if (open === 0 && high === 0 && low === 0 && close === 0) {
          console.warn('Пропущена невалидная запись со всеми нулевыми значениями:', item);
          continue;
        }
        
        // Проверка и исправление timestamp
        if (!timestamp || isNaN(timestamp)) {
          console.warn('Пропущена запись с невалидным timestamp:', item);
          continue;
        }
        
        // Проверки для избежания ошибок отрисовки
        // Если high < max(open, close), устанавливаем high = max(open, close) + small offset
        if (high < Math.max(open, close)) {
          high = Math.max(open, close) + 0.0001;
        }
        
        // Если low > min(open, close), устанавливаем low = min(open, close) - small offset
        if (low > Math.min(open, close)) {
          low = Math.min(open, close) - 0.0001;
        }
        
        // Дополнительная проверка: если high <= low, немного увеличиваем high и уменьшаем low
        if (high <= low) {
          const mid = (high + low) / 2;
          high = mid + 0.0001;
          low = mid - 0.0001;
        }
        
        // Добавляем отформатированные данные свечи
        formattedData.push({
          time: timestamp,
          open: open,
          high: high,
          low: low,
          close: close,
          volume: volume
        });
      }
    }
    
    console.log('Форматированные данные для графика:', formattedData.length);
    
    if (formattedData.length === 0) {
      console.warn('Нет форматированных данных для отображения графика');
      throw new Error('Нет данных для графика');
    }
    
    // Сортировка по времени
    formattedData.sort((a, b) => a.time - b.time);
      // Настройки для графика в версии 4.2
      const chartOptions = {
        width: chartContainerRef.current.clientWidth,
        height: height,
        layout: {
          background: { type: 'solid', color: darkMode ? '#1F2937' : '#F9FAFB' },
          textColor: darkMode ? '#9CA3AF' : '#6B7280',
        },
        grid: {
          vertLines: { color: darkMode ? '#374151' : '#E5E7EB' },
          horzLines: { color: darkMode ? '#374151' : '#E5E7EB' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: darkMode ? '#4B5563' : '#D1D5DB',
          rightOffset: 5, // Оставляем место справа для новых свечей
          barSpacing: 6, // Интервал между свечами
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        crosshair: {
          mode: 1, // CrosshairMode.Normal
        }
      };
      
      // Создаем график
      const chart = createChart(chartContainerRef.current, chartOptions);
      chartRef.current = chart;
      
      // Серии для свечей с настройками
      const candleStickOptions = {
        upColor: '#6ED684',
        downColor: '#EB5757',
        borderUpColor: '#6ED684',
        borderDownColor: '#EB5757',
        wickUpColor: '#6ED684',
        wickDownColor: '#EB5757',
      };
      
      let mainSeries;
      
      // Используем правильные методы API для версии 4.2
      if (type.includes('candlestick')) {
        mainSeries = chart.addCandlestickSeries(candleStickOptions);
        
        // Дополнительная проверка перед установкой данных
        if (formattedData.length > 0) {
          try {
            // Попробуем сначала установить одну свечу, чтобы проверить, правильно ли форматированы данные
            mainSeries.setData([formattedData[0]]);
            // Если успешно, установим остальные данные
            mainSeries.setData(formattedData);
          } catch (dataError) {
            console.error('Ошибка при установке данных свечей:', dataError);
            // В случае ошибки, установим заглушку с гарантированно валидными данными
            const placeholderData = [{
              time: Math.floor(Date.now() / 1000),
              open: 100,
              high: 101,
              low: 99,
              close: 100,
              volume: 100
            }];
            mainSeries.setData(placeholderData);
          }
        }
        
        // Добавляем объем если нужно
        if (type.includes('volume')) {
          try {
            const volumeSeries = chart.addHistogramSeries({
              color: '#64748B',
              priceFormat: {
                type: 'volume',
              },
              priceScaleId: 'volume',
              scaleMargins: {
                top: 0.8,
                bottom: 0,
              },
            });
            
            // Создаем данные для объема
            const volumeData = formattedData.map(item => ({
              time: item.time,
              value: item.volume || 0,
              color: item.close >= item.open ? 'rgba(76, 175, 80, 0.5)' : 'rgba(255, 82, 82, 0.5)'
            }));
            
            volumeSeries.setData(volumeData);
          } catch (volumeError) {
            console.error('Ошибка при добавлении объема:', volumeError);
          }
        }
      } else {
        // Линейный график
        mainSeries = chart.addLineSeries({
          color: '#3B82F6',
          lineWidth: 2,
        });
        
        // Создаем данные для линейного графика
        const lineData = formattedData.map(item => ({
          time: item.time,
          value: item.close
        }));
        
        mainSeries.setData(lineData);
      }
      
      // Сохраняем ссылку на серию
      candleSeriesRef.current = mainSeries;
      
      // Добавляем индикаторы
      if (indicators && indicators.length > 0) {
        // Функции для расчета индикаторов
        const calculateSMA = (data, period) => {
          const result = [];
          for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
              sum += data[j].close;
            }
            result.push({
              time: data[i].time,
              value: sum / period
            });
          }
          return result;
        };
        
        const calculateEMA = (data, period) => {
          const result = [];
          const multiplier = 2 / (period + 1);
          
          // Первое значение = SMA
          let sum = 0;
          for (let i = 0; i < period; i++) {
            sum += data[i].close;
          }
          let ema = sum / period;
          
          result.push({
            time: data[period - 1].time,
            value: ema
          });
          
          // Расчет остальных значений
          for (let i = period; i < data.length; i++) {
            ema = (data[i].close - ema) * multiplier + ema;
            result.push({
              time: data[i].time,
              value: ema
            });
          }
          
          return result;
        };
        
        indicators.forEach(indicator => {
          try {
            if (indicator.type === 'ma' || indicator.type === 'sma') {
              const maSeries = chart.addLineSeries({
                color: indicator.color || '#3B82F6',
                lineWidth: indicator.lineWidth || 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              
              // Рассчитываем и устанавливаем данные MA
              const period = indicator.period || 20;
              const maData = calculateSMA(formattedData, period);
              maSeries.setData(maData);
            } else if (indicator.type === 'ema') {
              const emaSeries = chart.addLineSeries({
                color: indicator.color || '#8B5CF6',
                lineWidth: indicator.lineWidth || 1,
                priceLineVisible: false,
                lastValueVisible: false,
              });
              
              // Рассчитываем и устанавливаем данные EMA
              const period = indicator.period || 50;
              const emaData = calculateEMA(formattedData, period);
              emaSeries.setData(emaData);
            }
          } catch (indError) {
            console.error(`Ошибка при добавлении индикатора ${indicator.type}:`, indError);
          }
        });
      }
      
      // Подгоняем график под данные
      chart.timeScale().fitContent();
      
      // Обработчик изменения размера окна
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // Добавление кнопок управления для реального времени и прокрутки
      const addChartControls = () => {
        // Проверяем, существует ли уже панель с кнопками
        let controlsPanel = document.getElementById('chart-controls-panel');
        if (controlsPanel) {
          controlsPanel.remove();
        }
        
        // Создаем панель с кнопками
        controlsPanel = document.createElement('div');
        controlsPanel.id = 'chart-controls-panel';
        controlsPanel.className = 'absolute top-4 right-4 flex space-x-2 z-10';
        
        // Кнопка "Показать все"
        const fitButton = document.createElement('button');
        fitButton.className = 'bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 text-sm';
        fitButton.textContent = 'Показать все';
        fitButton.onclick = () => {
          chart.timeScale().fitContent();
        };
        
        // Кнопка "Реальное время"
        const realtimeButton = document.createElement('button');
        realtimeButton.className = isRealtimeMode ? 
          'bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm' :
          'bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 text-sm';
        realtimeButton.textContent = 'Реальное время';
        realtimeButton.onclick = () => {
          setIsRealtimeMode(prev => {
            const newMode = !prev;
            // Если включили режим реального времени, прокручиваем к последним данным
            if (newMode && chartRef.current) {
              chartRef.current.timeScale().scrollToRealTime();
            }
            return newMode;
          });
        };
        
        // Добавляем кнопки на панель
        controlsPanel.appendChild(fitButton);
        controlsPanel.appendChild(realtimeButton);
        
        // Добавляем панель в контейнер графика
        chartContainerRef.current.appendChild(controlsPanel);
      };
      
      // Добавляем кнопки управления
      addChartControls();
      
      // Очистка при размонтировании
      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        
        // Отписка от WebSocket
        if (wsSubscriptionRef.current) {
          wsSubscriptionRef.current();
          wsSubscriptionRef.current = null;
        }
      };
    } catch (error) {
      console.error('Ошибка при инициализации графика:', error);
      setChartError(error.message || 'Неизвестная ошибка инициализации графика');
      displayErrorMessage(error.message || 'Неизвестная ошибка инициализации графика');
    }
  }, [data, darkMode, type, height, indicators, currentPair, interval, chartStatus]);
  
  // Подписка на WebSocket обновления
  useEffect(() => {
    // Подключение к WebSocket для обновлений в реальном времени
    const setupWebSocketUpdates = () => {
      if (!window.webSocketService || !candleSeriesRef.current || !chartRef.current) {
        return;
      }
      
      // Отписка от предыдущей подписки
      if (wsSubscriptionRef.current) {
        wsSubscriptionRef.current();
        wsSubscriptionRef.current = null;
      }
      
      // Подписка на обновления свечей
      wsSubscriptionRef.current = window.webSocketService.subscribeToChart(
        currentPair, 
        interval, 
        (data) => {
          if (!candleSeriesRef.current) return;
          
          try {
            console.log('Получено обновление графика:', data);
            
            // Извлекаем объект свечи из полученных данных
            // Это может быть непосредственно объект update или внутри свойства candle
            const update = data.candle || data;
            
            if (!update) {
              console.warn('Не найдены данные свечи в обновлении:', data);
              return;
            }
            
            // Защита от невалидных данных
            const open = parseFloat(update.open || 0);
            const high = parseFloat(update.high || 0);
            const low = parseFloat(update.low || 0);
            const close = parseFloat(update.close || 0);
            const volume = parseFloat(update.volume || 0);
            
            // Проверка на NaN после parseFloat
            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
              console.warn('Получены невалидные данные для обновления свечи:', update);
              return;
            }
            
            // Определяем время из обновления
            let timeValue;
            
            // Проверяем различные варианты расположения времени в данных
            if (update.time) {
              timeValue = update.time;
            } else if (update.openTime) {
              timeValue = update.openTime;
            } else if (data.time) { // Время может быть в родительском объекте
              timeValue = data.time;
            } else if (data.timestamp) { // Или в поле timestamp родительского объекта
              timeValue = Math.floor(data.timestamp / 1000);
            } else {
              // Если время не найдено, используем текущее время
              console.warn('Время не определено в обновлении свечи, используем текущее время:', data);
              timeValue = Math.floor(Date.now() / 1000);
            }
            
            // Проверяем, если timeValue в миллисекундах, конвертируем в секунды
            if (timeValue > 1000000000000) {
              timeValue = Math.floor(timeValue / 1000);
            }
            
            // Валидация и корректировка данных свечи
            let finalHigh = high;
            let finalLow = low;
            
            if (finalHigh < Math.max(open, close)) {
              finalHigh = Math.max(open, close) + 0.0001;
            }
            
            if (finalLow > Math.min(open, close)) {
              finalLow = Math.min(open, close) - 0.0001;
            }
            
            if (finalHigh <= finalLow) {
              const mid = (finalHigh + finalLow) / 2;
              finalHigh = mid + 0.0001;
              finalLow = mid - 0.0001;
            }
            
            // Форматирование данных обновления
            const candleUpdate = {
              time: timeValue,
              open: open,
              high: finalHigh,
              low: finalLow,
              close: close,
              volume: volume
            };
            
            console.log('Обновление свечи с данными:', candleUpdate);
            
            // Обновление свечи на графике
            candleSeriesRef.current.update(candleUpdate);
            
            // Если включен режим реального времени, прокручиваем к последним данным
            if (isRealtimeMode && chartRef.current) {
              chartRef.current.timeScale().scrollToRealTime();
            }
          } catch (error) {
            console.error('Ошибка при обновлении свечи:', error, data);
          }
        }
      );
    };
    
    // Настраиваем подписку WebSocket
    setupWebSocketUpdates();
    
    // Отписка при размонтировании
    return () => {
      if (wsSubscriptionRef.current) {
        wsSubscriptionRef.current();
        wsSubscriptionRef.current = null;
      }
    };
  }, [currentPair, interval, isRealtimeMode]);
  
  // Обновление режима реального времени
  useEffect(() => {
    if (isRealtimeMode && chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
      
      // Обновляем стиль кнопки
      const realtimeButton = document.querySelector('#chart-controls-panel button:nth-child(2)');
      if (realtimeButton) {
        realtimeButton.className = 'bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm';
      }
    } else if (!isRealtimeMode && chartRef.current) {
      // Обновляем стиль кнопки
      const realtimeButton = document.querySelector('#chart-controls-panel button:nth-child(2)');
      if (realtimeButton) {
        realtimeButton.className = 'bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 text-sm';
      }
    }
  }, [isRealtimeMode]);
  
   // Функция для отображения сообщения об ошибке
  const displayErrorMessage = (message) => {
    if (!chartContainerRef.current) return;
    
    // Очищаем контейнер
    while (chartContainerRef.current.firstChild) {
      chartContainerRef.current.removeChild(chartContainerRef.current.firstChild);
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'h-full w-full flex flex-col items-center justify-center';
    errorDiv.style.backgroundColor = darkMode ? '#1F2937' : '#F9FAFB';
    
    const errorIcon = document.createElement('div');
    errorIcon.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${darkMode ? '#9CA3AF' : '#6B7280'}" 
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
        <polyline points="16 7 22 7 22 13"></polyline>
      </svg>
    `;
    errorDiv.appendChild(errorIcon);
    
    const errorTitle = document.createElement('p');
    errorTitle.textContent = 'Сервис временно недоступен';
    errorTitle.className = 'text-xl text-gray-500 mt-4';
    errorDiv.appendChild(errorTitle);
    
    const errorMessageEl = document.createElement('p');
    errorMessageEl.textContent = message || 'Не удалось загрузить данные графика';
    errorMessageEl.className = 'text-gray-600 mt-2';
    errorDiv.appendChild(errorMessageEl);
    
    const pairInfo = document.createElement('p');
    pairInfo.textContent = `${currentPair} (${interval})`;
    pairInfo.className = 'text-gray-400 mt-4';
    errorDiv.appendChild(pairInfo);
    
    chartContainerRef.current.appendChild(errorDiv);
  };
  
  // Метод для программного обновления свечи (экспортируем через ref)
  useImperativeHandle(ref, () => ({
    updateCandle: (data) => {
      if (!candleSeriesRef.current) return;
      
      try {
        console.log('Программное обновление свечи:', data);
        
        // Извлекаем объект свечи из полученных данных
        // Это может быть непосредственно объект data или внутри свойства candle
        const candleData = data.candle || data;
        
        if (!candleData) {
          console.warn('Не найдены данные свечи в обновлении:', data);
          return;
        }
        
        // Защита от невалидных данных
        const open = parseFloat(candleData.open || 0);
        const high = parseFloat(candleData.high || 0);
        const low = parseFloat(candleData.low || 0);
        const close = parseFloat(candleData.close || 0);
        const volume = parseFloat(candleData.volume || 0);
        
        // Проверка на NaN после parseFloat
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
          console.warn('Получены невалидные данные для обновления свечи:', candleData);
          return;
        }
        
        // Определяем время из данных
        let timeValue;
        
        // Проверяем различные варианты расположения времени в данных
        if (candleData.time) {
          timeValue = convertTimeObjectToTimestamp(candleData.time);
        } else if (candleData.openTime) {
          timeValue = convertTimeObjectToTimestamp(candleData.openTime);
        } else if (data.time) { // Время может быть в родительском объекте
          timeValue = convertTimeObjectToTimestamp(data.time);
        } else if (data.timestamp) { // Или в поле timestamp родительского объекта
          timeValue = convertTimeObjectToTimestamp(data.timestamp);
        } else {
          // Если время не найдено, используем текущее время
          console.warn('Время не определено в данных свечи, используем текущее время:', data);
          timeValue = Math.floor(Date.now() / 1000);
        }
        
        console.log('Извлеченное время для программного обновления:', timeValue);
        
        // Валидация и корректировка данных свечи
        let finalHigh = high;
        let finalLow = low;
        
        if (finalHigh < Math.max(open, close)) {
          finalHigh = Math.max(open, close) + 0.0001;
        }
        
        if (finalLow > Math.min(open, close)) {
          finalLow = Math.min(open, close) - 0.0001;
        }
        
        if (finalHigh <= finalLow) {
          const mid = (finalHigh + finalLow) / 2;
          finalHigh = mid + 0.0001;
          finalLow = mid - 0.0001;
        }
        
        // Форматирование данных свечи
        const formattedCandle = {
          time: timeValue,
          open: open,
          high: finalHigh,
          low: finalLow,
          close: close,
          volume: volume
        };
        
        console.log('Форматированные данные для обновления свечи:', formattedCandle);
        
        // Обновление свечи на графике
        candleSeriesRef.current.update(formattedCandle);
      } catch (error) {
        console.error('Ошибка при программном обновлении свечи:', error, data);
      }
    },
    scrollToRealTime: () => {
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
      }
    },
    fitContent: () => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    },
    setRealtimeMode: (mode) => {
      setIsRealtimeMode(mode);
    }
  }));
  
  return (
    <div 
      ref={chartContainerRef} 
      className="w-full" 
      style={{ height: `${height}px`, position: 'relative' }}
    />
  );
});

export default ChartComponent;