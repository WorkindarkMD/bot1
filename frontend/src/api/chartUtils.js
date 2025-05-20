// src/utils/chartDataUtils.js
/**
 * Утилиты для преобразования и обработки данных графиков
 */

/**
 * Преобразует временную метку в единый формат (миллисекунды)
 * @param {number|string|Object} timeObj - Время в разных форматах
 * @returns {number} - Метка времени в миллисекундах
 */
export const normalizeTimestamp = (timeObj) => {
  // Если timeObj уже число
  if (typeof timeObj === 'number') {
    // Если это секунды (Unix timestamp), преобразуем в миллисекунды
    return timeObj > 1000000000000 ? timeObj : timeObj * 1000;
  }
  
  // Если это строка, пробуем преобразовать в timestamp
  if (typeof timeObj === 'string') {
    const timestamp = Date.parse(timeObj);
    return isNaN(timestamp) ? Date.now() : timestamp;
  }
  
  // Если это объект с полями даты
  if (timeObj && typeof timeObj === 'object') {
    // Если это объект Date
    if (timeObj instanceof Date) {
      return timeObj.getTime();
    }
    
    // Если это объект с полями year, month, day
    if (timeObj.year && timeObj.month && timeObj.day) {
      const date = new Date(timeObj.year, timeObj.month - 1, timeObj.day);
      return date.getTime();
    }
    
    // Если это объект с timestamp полем
    if (timeObj.timestamp) {
      return normalizeTimestamp(timeObj.timestamp);
    }
    
    // Если это объект с unixtime, unix или time полями
    if (timeObj.unixtime || timeObj.unix || timeObj.time) {
      const timeValue = timeObj.unixtime || timeObj.unix || timeObj.time;
      return normalizeTimestamp(timeValue);
    }
    
    // Если это объект с openTime полем
    if (timeObj.openTime) {
      return normalizeTimestamp(timeObj.openTime);
    }
  }
  
  // Если ничего не подошло, возвращаем текущее время
  return Date.now();
};

/**
 * Преобразует данные свечей из различных форматов в единый формат для API ApexCharts
 * @param {Array} candles - Данные свечей в разных форматах
 * @returns {Array} - Форматированные данные для ApexCharts
 */
export const formatCandlesForApexCharts = (candles) => {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return [];
  }
  
  return candles.map(candle => {
    // Заготовка для данных свечи
    let timestamp, open, high, low, close, volume;
    
    // Обработка различных форматов свечей
    if (Array.isArray(candle)) {
      // Формат массива [timestamp, open, high, low, close, volume]
      timestamp = normalizeTimestamp(candle[0]);
      open = parseFloat(candle[1] || 0);
      high = parseFloat(candle[2] || 0);
      low = parseFloat(candle[3] || 0);
      close = parseFloat(candle[4] || 0);
      volume = parseFloat(candle[5] || 0);
    } else {
      // Формат объекта
      timestamp = normalizeTimestamp(candle.openTime || candle.time || candle.timestamp || Date.now());
      open = parseFloat(candle.open || 0);
      high = parseFloat(candle.high || 0);
      low = parseFloat(candle.low || 0);
      close = parseFloat(candle.close || 0);
      volume = parseFloat(candle.volume || 0);
    }
    
    // Валидация значений OHLC
    if (isNaN(open)) open = 0;
    if (isNaN(high)) high = 0;
    if (isNaN(low)) low = 0;
    if (isNaN(close)) close = 0;
    if (isNaN(volume)) volume = 0;
    
    // Проверки для избежания ошибок отрисовки
    if (high < Math.max(open, close)) {
      high = Math.max(open, close) + 0.0001;
    }
    
    if (low > Math.min(open, close)) {
      low = Math.min(open, close) - 0.0001;
    }
    
    if (high <= low) {
      const mid = (high + low) / 2;
      high = mid + 0.0001;
      low = mid - 0.0001;
    }
    
    // Возвращаем данные в формате для ApexCharts
    return {
      x: new Date(timestamp),
      y: [open, high, low, close],
      volume: volume
    };
  });
};

/**
 * Преобразует временной интервал из разных форматов в стандартизированный
 * @param {string} interval - Временной интервал (1m, 1h, 1d и т.д.)
 * @returns {string} - Стандартизированный интервал
 */
export const normalizeInterval = (interval) => {
  if (!interval) return '1H';
  
  // Все варианты к нижнему регистру
  const lowerInterval = interval.toLowerCase();
  
  // Маппинг разных форматов интервалов
  const intervalMap = {
    '1m': '1m', '1min': '1m', '1minute': '1m', '1': '1m',
    '5m': '5m', '5min': '5m', '5minute': '5m', '5': '5m',
    '15m': '15m', '15min': '15m', '15minute': '15m', '15': '15m',
    '30m': '30m', '30min': '30m', '30minute': '30m', '30': '30m',
    '1h': '1H', '1hour': '1H', '60m': '1H', '60min': '1H', '60': '1H',
    '4h': '4H', '4hour': '4H', '240m': '4H', '240min': '4H', '240': '4H',
    '1d': '1D', '1day': '1D', 'd': '1D', 'day': '1D', '1440m': '1D', '1440': '1D',
    '1w': '1W', '1week': '1W', 'w': '1W', 'week': '1W'
  };
  
  return intervalMap[lowerInterval] || '1H';
};

/**
 * Преобразует интервал в миллисекунды
 * @param {string} interval - Временной интервал
 * @returns {number} - Интервал в миллисекундах
 */
export const intervalToMilliseconds = (interval) => {
  const normInterval = normalizeInterval(interval);
  
  const intervalMap = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1H': 60 * 60 * 1000,
    '4H': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000
  };
  
  return intervalMap[normInterval] || intervalMap['1H'];
};

/**
 * Форматирует число с учетом его значения
 * @param {number} value - Число для форматирования
 * @param {Object} options - Опции форматирования
 * @returns {string} - Форматированное число
 */
export const formatNumber = (value, options = {}) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return String(value);
  }
  
  const {
    minFractionDigits = 0,
    maxFractionDigits = 8,
    useGrouping = true,
    notation = 'standard', // 'standard', 'compact', 'scientific', 'engineering'
    compactDisplay = 'short', // 'short', 'long'
    currency = null,
    style = 'decimal', // 'decimal', 'currency', 'percent'
    locale = 'ru-RU'
  } = options;
  
  // Автоматическое определение оптимального количества десятичных знаков
  let determinedMaxFractionDigits = maxFractionDigits;
  
  if (value < 0.0001) determinedMaxFractionDigits = 8;
  else if (value < 0.01) determinedMaxFractionDigits = 6;
  else if (value < 0.1) determinedMaxFractionDigits = 4;
  else if (value < 1) determinedMaxFractionDigits = 4;
  else if (value < 10) determinedMaxFractionDigits = 2;
  else if (value >= 10000) determinedMaxFractionDigits = 0;
  else determinedMaxFractionDigits = 2;
  
  // Определяем минимальное количество знаков
  const determinedMinFractionDigits = Math.min(minFractionDigits, determinedMaxFractionDigits);
  
  try {
    const formatterOptions = {
      minimumFractionDigits: determinedMinFractionDigits,
      maximumFractionDigits: determinedMaxFractionDigits,
      useGrouping,
      notation,
      compactDisplay
    };
    
    // Если указана валюта, используем соответствующий стиль
    if (currency) {
      formatterOptions.style = 'currency';
      formatterOptions.currency = currency;
    } else {
      formatterOptions.style = style;
    }
    
    // Создаем объект форматирования
    const formatter = new Intl.NumberFormat(locale, formatterOptions);
    
    return formatter.format(value);
  } catch (error) {
    console.error('Ошибка при форматировании числа:', error);
    return value.toFixed(determinedMaxFractionDigits);
  }
};

/**
 * Генерирует демо-данные свечей
 * @param {string} symbol - Символ торговой пары
 * @param {string} interval - Временной интервал
 * @param {number} count - Количество свечей
 * @returns {Array} - Массив свечей
 */
export const generateDemoCandles = (symbol = 'BTCUSDT', interval = '1H', count = 100) => {
  const candles = [];
  const now = Date.now();
  const intervalMs = intervalToMilliseconds(interval);
  
  // Определяем базовую цену в зависимости от символа
  let lastClose;
  if (symbol.includes('BTC') || symbol.includes('XBT')) {
    lastClose = 45000 + Math.random() * 5000;
  } else if (symbol.includes('ETH')) {
    lastClose = 2800 + Math.random() * 300;
  } else if (symbol.includes('SOL')) {
    lastClose = 120 + Math.random() * 20;
  } else if (symbol.includes('BNB')) {
    lastClose = 380 + Math.random() * 40;
  } else {
    lastClose = 100 + Math.random() * 50;
  }
  
  for (let i = count - 1; i >= 0; i--) {
    const openTime = now - (i * intervalMs);
    const volatility = lastClose * 0.02; // 2% волатильность
    
    const open = lastClose;
    const direction = Math.random() > 0.5 ? 1 : -1; // Случайное направление
    const changePercent = Math.random() * 0.02; // До 2% изменения
    
    const close = open * (1 + direction * changePercent);
    const high = Math.max(open, close) + (Math.random() * volatility);
    const low = Math.min(open, close) - (Math.random() * volatility);
    const volume = Math.random() * 100 + 50;
    
    candles.push({
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime: openTime + intervalMs - 1
    });
    
    lastClose = close;
  }
  
  return candles;
};

/**
 * Форматирует размер для отображения (для объема или баланса) 
 * @param {number} value - Значение для форматирования
 * @returns {string} - Форматированное значение
 */
export const formatQuantity = (value) => {
  if (value >= 1000000000) {
    return (value / 1000000000).toFixed(2) + 'B';
  }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  }
  
  // Определение количества десятичных знаков в зависимости от значения
  if (value < 0.00001) return value.toFixed(8);
  if (value < 0.0001) return value.toFixed(6);
  if (value < 0.01) return value.toFixed(4);
  return value.toFixed(2);
};

/**
 * Преобразует формат интервала для разных бирж
 * @param {string} interval - Стандартный интервал
 * @param {string} exchange - Название биржи
 * @returns {string} - Интервал в формате конкретной биржи
 */
export const formatIntervalForExchange = (interval, exchange = 'binance') => {
  const normalizedInterval = normalizeInterval(interval);
  const lowerExchange = exchange.toLowerCase();
  
  // Преобразование для Binance
  if (lowerExchange === 'binance') {
    const binanceMap = {
      '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1H': '1h', '4H': '4h', '1D': '1d', '1W': '1w'
    };
    return binanceMap[normalizedInterval] || '1h';
  }
  
  // Преобразование для BitGet
  if (lowerExchange === 'bitget') {
    const bitgetMap = {
      '1m': '60', '5m': '300', '15m': '900', '30m': '1800',
      '1H': '3600', '4H': '14400', '1D': '86400', '1W': '604800'
    };
    return bitgetMap[normalizedInterval] || '3600';
  }
  
  // Преобразование для Bybit
  if (lowerExchange === 'bybit') {
    const bybitMap = {
      '1m': '1', '5m': '5', '15m': '15', '30m': '30',
      '1H': '60', '4H': '240', '1D': 'D', '1W': 'W'
    };
    return bybitMap[normalizedInterval] || '60';
  }
  
  // Для остальных бирж - стандартный формат
  return normalizedInterval;
};

/**
 * Расчет процентного изменения
 * @param {number} open - Цена открытия
 * @param {number} close - Цена закрытия
 * @returns {number} - Процент изменения
 */
export const calculatePercentChange = (open, close) => {
  if (!open || open === 0) return 0;
  return ((close - open) / open) * 100;
};

/**
 * Расчет индикатора SMA (Simple Moving Average)
 * @param {Array} data - Массив цен закрытия
 * @param {number} period - Период для расчета
 * @returns {Array} - Массив значений SMA
 */
export const calculateSMA = (data, period = 20) => {
  const result = [];
  
  // Проверяем входные данные
  if (!Array.isArray(data) || data.length === 0 || period <= 0) {
    return result;
  }
  
  // Получаем массив цен закрытия, если передан массив свечей
  const prices = data.map(candle => {
    if (Array.isArray(candle.y)) {
      return candle.y[3]; // Цена закрытия в формате ApexCharts
    } else if (typeof candle.close === 'number') {
      return candle.close;
    } else {
      return parseFloat(candle);
    }
  });
  
  // Если данных меньше периода, возвращаем пустой массив
  if (prices.length < period) {
    return result;
  }
  
  // Расчет SMA
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j];
    }
    
    const sma = sum / period;
    
    // Для ApexCharts формат с x и y
    if (data[i].x) {
      result.push({
        x: data[i].x,
        y: sma
      });
    } else {
      result.push(sma);
    }
  }
  
  return result;
};

/**
 * Расчет индикатора EMA (Exponential Moving Average)
 * @param {Array} data - Массив цен закрытия
 * @param {number} period - Период для расчета
 * @returns {Array} - Массив значений EMA
 */
export const calculateEMA = (data, period = 50) => {
  const result = [];
  
  // Проверяем входные данные
  if (!Array.isArray(data) || data.length === 0 || period <= 0) {
    return result;
  }
  
  // Получаем массив цен закрытия, если передан массив свечей
  const prices = data.map(candle => {
    if (Array.isArray(candle.y)) {
      return candle.y[3]; // Цена закрытия в формате ApexCharts
    } else if (typeof candle.close === 'number') {
      return candle.close;
    } else {
      return parseFloat(candle);
    }
  });
  
  // Если данных меньше периода, возвращаем пустой массив
  if (prices.length < period) {
    return result;
  }
  
  // Множитель
  const multiplier = 2 / (period + 1);
  
  // Первое значение EMA = SMA за период
  let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  
  // Расчет EMA
  for (let i = period - 1; i < prices.length; i++) {
    if (i === period - 1) {
      // Для первого элемента используем SMA
      if (data[i].x) {
        result.push({
          x: data[i].x,
          y: ema
        });
      } else {
        result.push(ema);
      }
    } else {
      // Для остальных используем формулу EMA
      ema = (prices[i] - ema) * multiplier + ema;
      
      if (data[i].x) {
        result.push({
          x: data[i].x,
          y: ema
        });
      } else {
        result.push(ema);
      }
    }
  }
  
  return result;
};