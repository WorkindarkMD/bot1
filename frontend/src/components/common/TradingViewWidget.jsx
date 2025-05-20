// src/components/common/TradingViewWidget.jsx
import React, { useEffect, useRef, memo, useImperativeHandle, forwardRef, useState } from 'react';

// Простой виджет TradingView с обработкой ошибок
const TradingViewWidget = forwardRef(function TradingViewWidget(props, ref) {
  const { 
    symbol = "BTCUSDT", 
    interval = "D",
    exchange = "BITGET",
    darkMode = true,
    onSymbolChange,
    onIntervalChange
  } = props;
  
  const container = useRef();
  const loadingIndicatorRef = useRef(null);
  const [lastSymbol, setLastSymbol] = useState(symbol);
  const [lastInterval, setLastInterval] = useState(interval);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Форматируем символ для TradingView
  const formatSymbol = (symbol) => {
    if (!symbol) return "BTCUSDT";
    return symbol.replace('/', '');
  };
  
  // Преобразование интервала для TradingView
  const formatInterval = (appInterval) => {
    const intervalMap = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1H': '60',
      '1h': '60',
      '4h': '240',
      '1D': 'D',
      '1d': 'D'
    };
    return intervalMap[appInterval] || 'D';
  };

  // Экспортируем методы для управления виджетом через ref
  useImperativeHandle(ref, () => ({
    // Метод для изменения символа
    changeSymbol: (newSymbol) => {
      if (newSymbol !== lastSymbol) {
        setLastSymbol(newSymbol);
        loadWidget(newSymbol, lastInterval);
        return true;
      }
      return false;
    },
    
    // Метод для изменения интервала
    changeInterval: (newInterval) => {
      if (newInterval !== lastInterval) {
        setLastInterval(newInterval);
        loadWidget(lastSymbol, newInterval);
        return true;
      }
      return false;
    }
  }));

  // Безопасное удаление дочернего элемента
  const safeRemoveChild = (parent, child) => {
    try {
      if (parent && child && parent.contains(child)) {
        parent.removeChild(child);
        return true;
      }
    } catch (err) {
      console.warn('Ошибка при удалении элемента:', err);
    }
    return false;
  };

  // Загрузка виджета с текущими параметрами
  const loadWidget = (symbolToUse, intervalToUse) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!container.current) return;
      
      // Очищаем содержимое контейнера
      while (container.current.firstChild) {
        container.current.removeChild(container.current.firstChild);
      }
      
      // Форматируем параметры
      const formattedSymbol = formatSymbol(symbolToUse);
      const formattedInterval = formatInterval(intervalToUse);
      const exchangeToUse = exchange.toUpperCase();
      
      // Добавляем контейнер для виджета
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'tradingview-widget-container';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';
      
      // Добавляем контейнер для copyright
      const copyrightContainer = document.createElement('div');
      copyrightContainer.className = 'tradingview-widget-copyright';
      copyrightContainer.style.position = 'absolute';
      copyrightContainer.style.bottom = '5px';
      copyrightContainer.style.right = '5px';
      copyrightContainer.style.fontSize = '11px';
      copyrightContainer.style.zIndex = '10';
      copyrightContainer.innerHTML = '<a href="https://ru.tradingview.com/" rel="noopener nofollow" target="_blank"><span style="color: #9CA3AF;">Предоставлено <span style="color: #3B82F6;">TradingView</span></span></a>';
      
      // Создаем скрипт с конфигурацией виджета
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = `
      {
        "autosize": true,
        "symbol": "${exchangeToUse}:${formattedSymbol}.P",
        "interval": "${formattedInterval}",
        "timezone": "exchange",
        "theme": "${darkMode ? 'dark' : 'light'}",
        "style": "1",
        "locale": "ru",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "withdateranges": true,
        "hide_side_toolbar": false,
        "allow_symbol_change": true,
        "save_image": false,
        "calendar": false,
        "studies": [
          "MASimple@tv-basicstudies"
        ],
        "container_id": "tradingview_widget"
      }`;
      
      // Добавляем заглушку и индикатор загрузки
      const loadingIndicator = document.createElement('div');
      loadingIndicatorRef.current = loadingIndicator; // Сохраняем ссылку
      loadingIndicator.style.height = '100%';
      loadingIndicator.style.width = '100%';
      loadingIndicator.style.display = 'flex';
      loadingIndicator.style.alignItems = 'center';
      loadingIndicator.style.justifyContent = 'center';
      loadingIndicator.style.backgroundColor = darkMode ? '#1F2937' : '#F9FAFB';
      loadingIndicator.style.color = darkMode ? '#9CA3AF' : '#6B7280';
      loadingIndicator.innerHTML = '<div>Загрузка графика...</div>';
      
      // Добавляем элементы в DOM
      container.current.appendChild(loadingIndicator);
      
      // Создаем контейнер для графика
      const chartContainer = document.createElement('div');
      chartContainer.id = 'tradingview_widget';
      chartContainer.style.height = '100%';
      chartContainer.style.width = '100%';
      
      // Обработчик ошибок для скрипта
      script.onerror = (error) => {
        console.error('Ошибка загрузки TradingView виджета:', error);
        setError('Ошибка загрузки графика TradingView. Пожалуйста, проверьте подключение к интернету.');
        if (loadingIndicatorRef.current) {
          loadingIndicatorRef.current.innerHTML = '<div style="text-align: center;"><div style="margin-bottom: 10px; color: #EF4444;">Не удалось загрузить график</div><div>Проверьте подключение к интернету или попробуйте позже</div></div>';
        }
      };
      
      // Обработчик загрузки виджета
      script.onload = () => {
        setLoading(false);
        // Безопасное удаление индикатора загрузки
        if (container.current && loadingIndicatorRef.current) {
          safeRemoveChild(container.current, loadingIndicatorRef.current);
          loadingIndicatorRef.current = null;
        }
        console.log(`TradingView widget loaded: ${exchangeToUse}:${formattedSymbol}.P (${formattedInterval})`);
      };
      
      // Удаляем индикатор загрузки и добавляем контейнер и скрипт
      setTimeout(() => {
        if (container.current) {
          // Безопасное удаление индикатора загрузки
          if (loadingIndicatorRef.current) {
            safeRemoveChild(container.current, loadingIndicatorRef.current);
          }
          
          // Добавляем новые элементы
          container.current.appendChild(chartContainer);
          container.current.appendChild(copyrightContainer);
          container.current.appendChild(script);
        }
      }, 500);
      
    } catch (err) {
      console.error('Ошибка инициализации TradingView виджета:', err);
      setError(err.message || 'Неизвестная ошибка при загрузке графика');
      setLoading(false);
    }
  };

  // Инициализация виджета при монтировании
  useEffect(() => {
    // Обновляем состояние и загружаем виджет с начальными значениями
    setLastSymbol(symbol);
    setLastInterval(interval);
    
    // Устанавливаем таймаут для избежания проблем с быстрым перерендерингом
    const initTimer = setTimeout(() => {
      loadWidget(symbol, interval);
    }, 300);
    
    // Очистка при размонтировании
    return () => {
      clearTimeout(initTimer);
      if (container.current) {
        while (container.current.firstChild) {
          safeRemoveChild(container.current, container.current.firstChild);
        }
      }
      loadingIndicatorRef.current = null;
    };
  }, []);

  // Обновляем виджет при изменении props
  useEffect(() => {
    // Определяем, нужно ли перезагружать виджет
    if (symbol !== lastSymbol || interval !== lastInterval) {
      const reloadTimer = setTimeout(() => {
        loadWidget(symbol, interval);
        setLastSymbol(symbol);
        setLastInterval(interval);
      }, 300);
      
      return () => clearTimeout(reloadTimer);
    }
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container-wrapper relative" style={{ height: "100%", width: "100%" }}>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-red-400 font-medium mb-2">Ошибка загрузки графика</div>
            <div className="text-gray-400">{error}</div>
            <button 
              className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              onClick={() => loadWidget(lastSymbol, lastInterval)}
            >
              Попробовать снова
            </button>
          </div>
        </div>
      )}
      <div ref={container} className="tradingview-container" style={{ height: "100%", width: "100%" }} />
    </div>
  );
});

export default memo(TradingViewWidget);