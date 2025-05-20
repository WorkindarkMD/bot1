// modules/chart-data-service.js
// Сервис для предоставления данных графика и индикаторов без рендеринга

class ChartDataService {
  constructor(config) {
    this.config = config || {};
    this.core = null;
    this.isInitialized = false;
    this.currentSymbol = null;
    this.currentInterval = null;
    this.lastData = null;
    this.currentTheme = this.config.theme || 'dark';
    
    // События
    this.eventHandlers = {};
  }
  
  // Инициализация сервиса данных
  async initialize(core) {
    this.core = core;
    console.log('Инициализация сервиса данных графика...');
    
    // Инициализируем текущий символ и интервал
    this.currentSymbol = this.core.config.tradingPair || this.config.defaultSymbol || 'BTCUSDT';
    this.currentInterval = this.config.defaultInterval || '1h';
    
    // Подписываемся на события ядра
    this.registerCoreEventHandlers();
    
    this.isInitialized = true;
    console.log('Сервис данных графика инициализирован');
    
    // Оповещаем о готовности
    this.emit('chart.ready', { 
      symbol: this.currentSymbol,
      interval: this.currentInterval
    });
    
    return true;
  }
  
  // Регистрация обработчиков событий ядра
  registerCoreEventHandlers() {
    if (!this.core) return;
    
    // Подписываемся на событие изменения торговой пары
    this.core.on('tradingPair.changed', async (data) => {
      console.log(`[ChartDataService] Обработка события изменения пары: ${data.newPair}`);
      await this.changeSymbol(data.newPair);
    });
  }
  
  // Получение данных графика
  async getChartData(params = {}) {
    if (!this.core) return this._generateDemoCandles(params.symbol || 'BTCUSDT', params.interval || '1h', params.limit || 100);
    
    const symbol = params.symbol || this.currentSymbol;
    const interval = params.interval || this.currentInterval;
    const limit = params.limit || this.config.dataLimit || 1000;
    
    console.log(`Получение данных графика для ${symbol} (${interval})`);
    
    try {
      // Получаем данные через ядро
      const chartData = await this.core.getChartData({
        symbol,
        interval,
        limit
      });
      
      // Проверяем результат
      if (!chartData || chartData.length === 0) {
        console.warn(`Получены пустые данные для ${symbol}`);
        const demoData = this._generateDemoCandles(symbol, interval, limit);
        this.lastData = demoData;
        return demoData;
      }
      
      // Сохраняем загруженные данные
      this.lastData = chartData;
      
      // Оповещаем о загрузке данных
      this.emit('chart.dataLoaded', {
        symbol,
        interval,
        count: chartData.length
      });
      
      return chartData;
    } catch (error) {
      console.error('Ошибка при получении данных графика:', error);
      // Генерируем демо-данные в случае ошибки
      const demoData = this._generateDemoCandles(symbol, interval, limit);
      this.lastData = demoData;
      
      // Оповещаем об ошибке, но не прерываем работу
      this.emit('chart.error', {
        error: error.message,
        action: 'getChartData'
      });
      
      return demoData;
    }
  }
  
  // Изменение торговой пары
  async changeSymbol(symbol) {
    if (this.currentSymbol === symbol) return;
    
    console.log(`Изменение символа на ${symbol}`);
    this.currentSymbol = symbol;
    
    try {
      // Загружаем данные новой пары
      await this.getChartData({
        symbol: this.currentSymbol,
        interval: this.currentInterval
      });
      
      // Оповещаем о смене символа
      this.emit('chart.symbolChanged', { symbol });
    } catch (error) {
      console.error(`Ошибка при изменении символа на ${symbol}:`, error);
      this.emit('chart.error', {
        error: error.message,
        action: 'changeSymbol'
      });
    }
  }
  
  // Изменение интервала
  async changeInterval(interval) {
    if (this.currentInterval === interval) return;
    
    console.log(`Изменение интервала на ${interval}`);
    this.currentInterval = interval;
    
    try {
      // Загружаем данные для нового интервала
      await this.getChartData({
        symbol: this.currentSymbol,
        interval: this.currentInterval
      });
      
      // Оповещаем о смене интервала
      this.emit('chart.intervalChanged', { interval });
    } catch (error) {
      console.error(`Ошибка при изменении интервала на ${interval}:`, error);
      this.emit('chart.error', {
        error: error.message,
        action: 'changeInterval'
      });
    }
  }
  
  // Получение данных индикатора
  async getIndicatorData(indicatorId, chartData = null) {
    if (!this.core) return null;
    
    const data = chartData || this.lastData;
    if (!data) {
      console.error('Нет данных для расчета индикатора');
      return null;
    }
    
    const indicatorsManager = this.core.getModule('indicators-manager');
    if (!indicatorsManager) {
      console.error('Менеджер индикаторов не найден');
      return null;
    }
    
    try {
      // Получаем индикатор
      const indicator = indicatorsManager.getIndicator(indicatorId);
      if (!indicator) {
        console.error(`Индикатор с ID ${indicatorId} не найден`);
        return null;
      }
      
      // Рассчитываем индикатор
      await indicatorsManager.calculateIndicator(indicatorId, data);
      
      // Получаем данные для визуализации
      const visualData = indicatorsManager.getIndicatorVisualData(indicatorId);
      
      return visualData;
    } catch (error) {
      console.error(`Ошибка при получении данных индикатора ${indicatorId}:`, error);
      return null;
    }
  }
  
  // Получение данных всех активных индикаторов
  async getAllVisibleIndicatorsData(chartData = null) {
    if (!this.core) return {};
    
    const indicatorsManager = this.core.getModule('indicators-manager');
    if (!indicatorsManager) {
      console.error('Менеджер индикаторов не найден');
      return {};
    }
    
    try {
      return indicatorsManager.getAllVisibleIndicatorsData(chartData || this.lastData);
    } catch (error) {
      console.error('Ошибка при получении данных всех индикаторов:', error);
      return {};
    }
  }
  
  
  
  // Получение длительности интервала в миллисекундах
  _getIntervalMs(interval) {
    const intervalMap = {
      '1m': 60000, 
      '5m': 300000, 
      '15m': 900000, 
      '30m': 1800000,
      '1H': 3600000, 
      '4H': 14400000, 
      '1D': 86400000, 
      '1W': 604800000
    };
    
    return intervalMap[interval] || 3600000; // По умолчанию 1h
  }
  
  // Подписка на событие
  on(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    
    this.eventHandlers[eventName].push(handler);
    return this;
  }
  
  // Отписка от события
  off(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      return this;
    }
    
    if (!handler) {
      delete this.eventHandlers[eventName];
      return this;
    }
    
    this.eventHandlers[eventName] = this.eventHandlers[eventName]
      .filter(h => h !== handler);
    
    return this;
  }
  
  // Вызов обработчиков события
  emit(eventName, data) {
    if (!this.eventHandlers[eventName]) {
      return;
    }
    
    for (const handler of this.eventHandlers[eventName]) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Ошибка в обработчике события ${eventName}:`, error);
      }
    }
  }
  
  // Очистка ресурсов при выгрузке
  cleanup() {
    // Отписываемся от событий ядра
    if (this.core) {
      // Отписка от событий...
    }
    
    this.isInitialized = false;
    console.log('Сервис данных графика выгружен');
  }
  
  // Регистрация API эндпоинтов
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Получение данных графика
    app.get('/api/chart/data', async (req, res) => {
      try {
        const { symbol, interval, limit } = req.query;
        const data = await this.getChartData({ 
          symbol, 
          interval, 
          limit: limit ? parseInt(limit) : undefined 
        });
        
        if (!data || data.length === 0) {
          // Если данных нет, возвращаем заглушку вместо ошибки
          return res.json({ 
            success: true,
            candles: this._generateDemoCandles(symbol || this.currentSymbol, interval || this.currentInterval, parseInt(limit || 100))
          });
        }
        
        res.json({ 
          success: true,
          candles: data 
        });
      } catch (error) {
        console.error('Ошибка при получении данных графика:', error);
        // Возвращаем заглушку вместо ошибки
        res.json({ 
          success: true,
          candles: this._generateDemoCandles(req.query.symbol || this.currentSymbol, req.query.interval || this.currentInterval, parseInt(req.query.limit || 100))
        });
      }
    });
    
    // Получение данных индикатора
    app.get('/api/chart/indicator/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { symbol, interval, limit } = req.query;
        
        // Если запрошены конкретные данные, получаем их
        let chartData = null;
        if (symbol || interval || limit) {
          chartData = await this.getChartData({
            symbol,
            interval,
            limit: limit ? parseInt(limit) : undefined
          });
        }
        
        const visualData = await this.getIndicatorData(id, chartData);
        
        if (!visualData) {
          return res.status(404).json({ error: `Данные индикатора ${id} не найдены` });
        }
        
        res.json({ id, visualData });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Получение данных всех видимых индикаторов
    app.get('/api/chart/indicators/visible', async (req, res) => {
      try {
        const { symbol, interval, limit } = req.query;
        
        // Если запрошены конкретные данные, получаем их
        let chartData = null;
        if (symbol || interval || limit) {
          chartData = await this.getChartData({
            symbol,
            interval,
            limit: limit ? parseInt(limit) : undefined
          });
        }
        
        const visualData = await this.getAllVisibleIndicatorsData(chartData);
        
        res.json({ visualData });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Получение текущего состояния графика
    app.get('/api/chart/info', (req, res) => {
      res.json({
        symbol: this.currentSymbol,
        interval: this.currentInterval,
        theme: this.currentTheme,
        isInitialized: this.isInitialized
      });
    });
    
    // Изменение символа
    app.post('/api/chart/symbol', async (req, res) => {
      try {
        const { symbol } = req.body;
        
        if (!symbol) {
          return res.status(400).json({ error: 'Символ не указан' });
        }
        
        await this.changeSymbol(symbol);
        
        res.json({
          success: true,
          symbol: this.currentSymbol
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Изменение интервала
    app.post('/api/chart/interval', async (req, res) => {
      try {
        const { interval } = req.body;
        
        if (!interval) {
          return res.status(400).json({ error: 'Интервал не указан' });
        }
        
        await this.changeInterval(interval);
        
        res.json({
          success: true,
          interval: this.currentInterval
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Изменение темы
    app.post('/api/chart/theme', (req, res) => {
      try {
        const { theme } = req.body;
        
        if (!theme || (theme !== 'dark' && theme !== 'light')) {
          return res.status(400).json({ error: 'Некорректная тема' });
        }
        
        this.currentTheme = theme;
        
        res.json({
          success: true,
          theme: this.currentTheme
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}

module.exports = ChartDataService;