// app.js - Основной интерфейс приложения
const axios = require('axios')
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const TradingCore = require('./core');
const SignalsManager = require('./modules/signals-manager');
const fs = require('fs');
const config = require('./config');

class TradingApp {
  constructor() {
    this.app = express();
	  this.app.use((req, res, next) => {
      const startTime = Date.now();
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] → ${req.method} ${req.url}`);
      
      // Перехват окончания ответа для логирования статуса и времени выполнения
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;
        const endTimestamp = new Date().toISOString();
        console.log(`[${endTimestamp}] ← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
        return originalEnd.apply(this, args);
      };
      
      next();
    });

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.core = new TradingCore();
    this.loadedModules = [];
    this.signalsManager = null;
  }

  // Инициализация приложения
  async initialize() {
    console.log('Инициализация торгового приложения...');
    
    // Настройка Express
    this.setupExpress();
    
    // Настройка WebSocket
    this.setupWebSocket();
    
   // В методе initialize класса TradingApp
await this.core.initialize({
  ...config.core,
  apiKeys: {
    binance: {
      apiKey: config.connections.binance.apiKey,
      secretKey: config.connections.binance.secretKey
    },
    bitget: {
      apiKey: config.connections.bitget.apiKey,
      secretKey: config.connections.bitget.secretKey,
      passphrase: config.connections.bitget.passphrase
    }
  }
});
    
    // Загрузка модулей
    await this.loadModules();

    // === SignalsManager ===
    // Инициализация и регистрация signals-manager
    this.signalsManager = new SignalsManager({
      signalsFile: require('path').join(process.cwd(), 'signals.json'),
      // Можно добавить другие настройки автоматизации здесь
    });
    this.signalsManager.core = this.core;
    await this.signalsManager.initialize();
    if (typeof this.signalsManager.registerApiEndpoints === 'function') {
      this.signalsManager.registerApiEndpoints(this.app);
      console.log('API эндпоинты SignalsManager успешно зарегистрированы');
    }
    this.core.registerModule('signals-manager', this.signalsManager);
    // === SignalsManager END ===

    // Регистрация API эндпоинтов модулей
    this.registerModuleApiEndpoints();

    // === Регистрация роутов сигналов для ручного поиска ===
    const signalsRoutes = require('./routes/signals')(this.core, this.signalsManager);
    this.app.use('/api/signals', signalsRoutes);

    console.log('Торговое приложение успешно инициализировано');
  }

setupExpress() {
  // Добавляем CORS middleware
  this.app.use((req, res, next) => {
    // Проверяем, откуда пришел запрос
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:4000'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  });

    // Настройка Content Security Policy
    this.app.use((req, res, next) => {
      /*res.setHeader(
        *'Content-Security-Policy',
       * "default-src 'self'; " +
       * "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
       * "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
       * "img-src 'self' data: https:; " +
       * "font-src 'self' https://cdn.jsdelivr.net; " +
       * "connect-src 'self' wss: ws:;"
      );
      */next();
    });
    
    // Обработка статических файлов
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Middleware для обработки JSON
    this.app.use(express.json());
    
    // Настройка маршрутов API
    this.setupApiRoutes();
    
    // Обработка маршрута для главной страницы
    this.app.get('/api/orders', async (req, res) => {
      try {
        const pair = req.query.pair || this.core.config.tradingPair;
        let exchange;
        
        try {
          exchange = this.core.getActiveExchangeConnector();
        } catch (error) {
          console.warn('Не удалось получить активный коннектор:', error.message);
        }

        if (exchange && typeof exchange.getOpenOrders === 'function') {
          const openOrders = await exchange.getOpenOrders(pair);
          return res.json({ 
            success: true, 
            orders: openOrders 
          });
        } else {
          // Попытка получить ордера через модуль автотрейдинга, если он существует
          const autoTrader = this.core.getModule('auto-trader');
          if (autoTrader && typeof autoTrader.getActiveOrders === 'function') {
            const orders = await autoTrader.getActiveOrders(pair);
            return res.json({ 
              success: true, 
              orders 
            });
          }
          
          return res.status(404).json({
            success: false,
            error: 'Сервис для получения ордеров недоступен'
          });
        }
      } catch (error) {
        console.error('Ошибка при получении ордеров:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Обработка маршрутов для дополнительных страниц
    this.app.get('/analytics', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
    });

    this.app.get('/positions', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'positions.html'));
    });

    this.app.get('/settings', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'settings.html'));
    });
  }

  // Настройка маршрутов API
  setupApiRoutes() {
    // Универсальный endpoint для получения торговых пар (spot/futures)
    this.app.get('/api/pairs', async (req, res) => {
      try {
        const exchangeName = req.query.exchange || this.core.config.exchange;
        const marketType = req.query.type || 'spot'; // 'spot' или 'futures'
        const productType = req.query.productType || 'umcbl'; // для фьючерсов

        let exchangeConnector;
        try {
          exchangeConnector = this.core.exchangeConnectors[exchangeName] || this.core.getActiveExchangeConnector();
        } catch (error) {
          return res.status(400).json({ success: false, error: `Коннектор для биржи ${exchangeName} не найден: ${error.message}` });
        }

        if (!exchangeConnector) {
          return res.status(400).json({ success: false, error: `Биржа ${exchangeName} не подключена` });
        }

        let pairs = [];
        if (marketType === 'futures' && typeof exchangeConnector.getFuturesTradingPairs === 'function') {
          pairs = await exchangeConnector.getFuturesTradingPairs(productType);
        } else if (typeof exchangeConnector.getTradingPairs === 'function') {
          pairs = await exchangeConnector.getTradingPairs();
        }

        res.json({ success: true, data: pairs });
      } catch (error) {
        console.error('Ошибка при получении списка пар:', error);
        res.status(500).json({ success: false, error: error.message, data: [] });
      }
    });

    const self = this;
    // Добавить в секцию setupApiRoutes в app.js - бэкенд

// Маршрут для объединенной инициализации - один запрос вместо многих
this.app.get('/api/init', async (req, res) => {
  try {
    // Соберем все необходимые данные за один запрос
    const [status, settings, exchanges, pairs] = await Promise.all([
      // Статус системы
      {
        success: true,
        status: 'ok',
        core: {
          initialized: this.core.isInitialized,
          exchange: this.core.config.exchange,
          tradingPair: this.core.config.tradingPair,
          modules: this.loadedModules.length,
          activeConnectors: Object.keys(this.core.exchangeConnectors || {})
        }
      },
      
      // Настройки (с фильтрацией приватных данных)
      (() => {
        // Создаем копию настроек, убрав конфиденциальные данные
        const safeConfig = JSON.parse(JSON.stringify(config));
        
        // Убираем секретные ключи
        for (const exchange in safeConfig.connections) {
          if (safeConfig.connections[exchange]?.secretKey) {
            safeConfig.connections[exchange].secretKey = '********';
          }
          if (safeConfig.connections[exchange]?.passphrase) {
            safeConfig.connections[exchange].passphrase = '********';
          }
        }
        
        return {
          success: true,
          settings: safeConfig
        };
      })(),
      
      // Список бирж
      {
        success: true,
        exchanges: ['binance', 'bybit', 'bitget', 'mexc'].filter(exchange => 
          this.core.exchangeConnectors[exchange] || 
          config.connections[exchange]?.apiKey
        )
      },
      
      // Список пар для активной биржи
      (async () => {
        try {
          const exchangeName = this.core.config.exchange;
          const marketType = 'spot'; // По умолчанию спот
          
          let exchangeConnector;
          
          try {
            exchangeConnector = this.core.getActiveExchangeConnector();
          } catch (error) {
            return { 
              success: false, 
              error: `Коннектор для биржи ${exchangeName} не найден: ${error.message}`,
              data: []
            };
          }
          
          if (!exchangeConnector) {
            return { 
              success: false, 
              error: `Биржа ${exchangeName} не подключена`,
              data: []
            };
          }
          
          let pairs;
          
          // Получаем список пар
          pairs = await exchangeConnector.getTradingPairs();
          
          return { 
            success: true, 
            data: pairs 
          };
        } catch (error) {
          console.error('Ошибка при получении списка пар:', error);
          return { 
            success: false, 
            error: error.message,
            data: []
          };
        }
      })()
    ]);
    
    // Вернем все данные в одном ответе
    res.json({
      status,
      settings,
      exchanges,
      pairs
    });
  } catch (error) {
    console.error('Ошибка при инициализации данных:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

    // Маршрут для получения списка доступных бирж
    this.app.get('/api/exchanges', (req, res) => {
      res.json({
        success: true,
        exchanges: ['binance', 'bybit', 'bitget', 'mexc'].filter(exchange => 
          this.core.exchangeConnectors[exchange] || 
          config.connections[exchange]?.apiKey
        )
      });
    });
    
    // Маршрут для получения списка доступных торговых пар
   // Маршрут для получения списка доступных торговых пар
this.app.get('/api/pairs', async (req, res) => {
  try {
    const exchangeName = req.query.exchange || this.core.config.exchange;
    const marketType = req.query.type || 'spot'; // 'spot' или 'futures'
    
    let exchangeConnector;
    
    // Если указана другая биржа, используем её коннектор
    if (exchangeName !== this.core.config.exchange && this.core.exchangeConnectors[exchangeName]) {
      exchangeConnector = this.core.exchangeConnectors[exchangeName];
    } else {
      try {
        exchangeConnector = this.core.getActiveExchangeConnector();
      } catch (error) {
        return res.status(400).json({ 
          success: false, 
          error: `Коннектор для биржи ${exchangeName} не найден: ${error.message}` 
        });
      }
    }
    
    if (!exchangeConnector) {
      return res.status(400).json({ 
        success: false, 
        error: `Биржа ${exchangeName} не подключена` 
      });
    }
    
    let pairs;
    
    // Получаем список пар в зависимости от типа рынка
    if (marketType === 'futures' && typeof exchangeConnector.getFuturesTradingPairs === 'function') {
      pairs = await exchangeConnector.getFuturesTradingPairs();
    } else {
      pairs = await exchangeConnector.getTradingPairs();
    }
    
    // Возвращаем список пар в стандартизированном формате
    res.json({ 
      success: true, 
      data: pairs 
    });
  } catch (error) {
    console.error('Ошибка при получении списка пар:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      data: [] // Возвращаем пустой массив даже в случае ошибки
    });
  }
});
    
 // Маршрут для получения данных графика
this.app.get('/api/chart', async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Получен запрос к /api/chart с параметрами:`, req.query);
  
  try {
    const { pair, interval, limit, endTime, type } = req.query;
    
    let exchange;
    try {
      exchange = self.core.getActiveExchangeConnector();
      console.log(`[${new Date().toISOString()}] Получен коннектор биржи: ${exchange ? exchange.constructor.name : 'undefined'}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Не удалось получить коннектор биржи:`, error);
      
      // Возвращаем заглушку
      return res.json({ 
        success: true, 
        candles: [] 
      });
    }
    
    // Параметры запроса
    const params = {
      symbol: pair || self.core.config.tradingPair || 'BTCUSDT',
      interval: interval || '1h',
      limit: parseInt(limit || 100, 10),
      endTime: endTime ? parseInt(endTime) : undefined,
      marketType: type || 'futures'
    };
    
    console.log(`[${new Date().toISOString()}] Параметры запроса к API биржи:`, params);
    
    try {
      const chartData = await exchange.getChartData(params);
      
      console.log(`[${new Date().toISOString()}] Получены данные от биржи, тип:`, 
                 typeof chartData, Array.isArray(chartData) ? `Array[${chartData.length}]` : 
                 chartData ? Object.keys(chartData) : 'null');
      
      // Создаем массив свечей в стандартном формате
      let candles = [];
      
      try {
        // Формат BitGet: API возвращает { code, msg, requestTime, data: [...] }
        if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.code !== undefined && chartData.data) {
          console.log(`[${new Date().toISOString()}] Обнаружен формат BitGet API, обрабатываем данные из chartData.data`);
          candles = processExchangeCandles(chartData.data);
        } 
        // Другие форматы: обычный массив свечей или другие структуры
        else if (Array.isArray(chartData)) {
          console.log(`[${new Date().toISOString()}] Данные в формате массива, обрабатываем напрямую`);
          candles = processExchangeCandles(chartData);
        } 
        else {
          console.log(`[${new Date().toISOString()}] Неизвестный формат данных, возвращаем пустой массив`);
          candles = [];
        }
      } catch (processingError) {
        console.error(`[${new Date().toISOString()}] Ошибка при обработке данных свечей:`, processingError);
        candles = [];
      }
      
      console.log(`[${new Date().toISOString()}] Обработано ${candles.length} свечей`);
      
      // Если есть данные, выводим первую свечу для отладки
      if (candles.length > 0) {
        console.log('Пример обработанной свечи:', JSON.stringify(candles[0]));
      }
      
      // Всегда возвращаем одинаковую структуру
      const response = { 
        success: true, 
        candles: candles 
      };
      
      res.json(response);
      
      const endTime = Date.now();
      console.log(`[${new Date().toISOString()}] Запрос /api/chart обработан за ${endTime - startTime}ms`);
      
    } catch (err) {
      console.warn(`[${new Date().toISOString()}] Ошибка получения данных графика:`, err);
      
      // При ошибке возвращаем пустой массив
      res.json({ 
        success: true, 
        candles: [] 
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Глобальная ошибка при обработке запроса /api/chart:`, error);
    
    res.json({ 
      success: true, 
      candles: [] 
    });
  }
});

// Функция для обработки свечей от биржи
function processExchangeCandles(candles) {
  if (!Array.isArray(candles)) {
    console.warn('processExchangeCandles: входные данные не являются массивом');
    return [];
  }
  
  const result = [];
  
  for (let i = 0; i < candles.length; i++) {
    const item = candles[i];
    
    // Пропускаем null или undefined
    if (!item) continue;
    
    try {
      let candleData = {};
      
      // Обработка массива [timestamp, open, high, low, close, volume]
      if (Array.isArray(item)) {
        // Убедимся, что у нас достаточно данных
        if (item.length < 5) {
          console.warn('Недостаточно элементов в массиве свечи:', item);
          continue;
        }
        
        candleData = {
          openTime: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: item.length > 5 ? parseFloat(item[5]) : 0
        };
      } 
      // Обработка объекта {o, h, l, c, t, v} или {open, high, low, close, time/openTime, volume}
      else if (typeof item === 'object') {
        // Получаем время открытия
        let openTime;
        if (item.openTime !== undefined) {
          openTime = typeof item.openTime === 'number' ? item.openTime : new Date(item.openTime).getTime();
        } else if (item.time !== undefined) {
          openTime = typeof item.time === 'number' ? item.time : new Date(item.time).getTime();
        } else if (item.t !== undefined) {
          openTime = typeof item.t === 'number' ? item.t : new Date(item.t).getTime();
        } else {
          console.warn('Не удалось определить время свечи:', item);
          continue;
        }
        
        // Получаем OHLC значения
        const open = parseFloat(item.open !== undefined ? item.open : (item.o !== undefined ? item.o : 0));
        const high = parseFloat(item.high !== undefined ? item.high : (item.h !== undefined ? item.h : 0));
        const low = parseFloat(item.low !== undefined ? item.low : (item.l !== undefined ? item.l : 0));
        const close = parseFloat(item.close !== undefined ? item.close : (item.c !== undefined ? item.c : 0));
        const volume = parseFloat(item.volume !== undefined ? item.volume : (item.v !== undefined ? item.v : 0));
        
        candleData = {
          openTime,
          open,
          high,
          low,
          close,
          volume
        };
      } else {
        console.warn('Неизвестный формат свечи:', item);
        continue;
      }
      
      // Проверяем валидность данных
      if (isNaN(candleData.open) || isNaN(candleData.high) || 
          isNaN(candleData.low) || isNaN(candleData.close)) {
        console.warn('Невалидные значения OHLC:', candleData);
        continue;
      }
      
      // Убедимся, что high и low корректны
      if (candleData.high < candleData.low) {
        const correctHigh = Math.max(candleData.open, candleData.close);
        const correctLow = Math.min(candleData.open, candleData.close);
        candleData.high = correctHigh;
        candleData.low = correctLow;
      }
      
      // Если high и low равны, добавляем небольшой разброс
      if (candleData.high === candleData.low) {
        candleData.high += 0.0001;
        candleData.low -= 0.0001;
      }
      
      result.push(candleData);
    } catch (err) {
      console.error('Ошибка при обработке свечи:', err, item);
    }
  }
  
  return result;
}

    
    // Маршрут для проверки статуса сервера
    this.app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        status: 'ok',
        core: {
          initialized: this.core.isInitialized,
          exchange: this.core.config.exchange,
          tradingPair: this.core.config.tradingPair,
          modules: this.loadedModules.length,
          activeConnectors: Object.keys(this.core.exchangeConnectors || {})
        }
      });
    });

    // Маршрут для получения настроек системы
    this.app.get('/api/settings', (req, res) => {
      // Возвращаем копию настроек, убрав конфиденциальные данные
      const safeConfig = JSON.parse(JSON.stringify(config));
      
      // Убираем секретные ключи
      for (const exchange in safeConfig.connections) {
        if (safeConfig.connections[exchange]?.secretKey) {
          safeConfig.connections[exchange].secretKey = '********';
        }
        if (safeConfig.connections[exchange]?.passphrase) {
          safeConfig.connections[exchange].passphrase = '********';
        }
      }
      
      res.json({
        success: true,
        settings: safeConfig
      });
    });

    // Маршрут для сохранения настроек
    this.app.post('/api/settings', async (req, res) => {
      try {
        const newSettings = req.body;
        
        if (!newSettings || typeof newSettings !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Некорректный формат настроек'
          });
        }
        
        // Сохраняем настройки в файл
        const configPath = path.join(process.cwd(), 'user_config.json');
        await fs.promises.writeFile(configPath, JSON.stringify(newSettings, null, 2));
        
        res.json({
          success: true,
          message: 'Настройки успешно сохранены'
        });
      } catch (error) {
        console.error('Ошибка при сохранении настроек:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
    
    // Маршрут для аналитики
    this.app.get('/api/analytics/data', async (req, res) => {
      try {
        const tradingAnalytics = this.core.getModule('trading-analytics');
        
        if (!tradingAnalytics) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль аналитики не найден' 
          });
        }
        
        const analyticsData = tradingAnalytics.getAnalyticsData();
        
        res.json({
          success: true,
          ...analyticsData
        });
      } catch (error) {
        console.error('Ошибка при получении аналитических данных:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Маршрут для получения ежедневной статистики
    this.app.get('/api/analytics/daily-stats', async (req, res) => {
      try {
        const tradingAnalytics = this.core.getModule('trading-analytics');
        
        if (!tradingAnalytics) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль аналитики не найден' 
          });
        }
        
        const dailyStats = await tradingAnalytics.getDailyStats();
        
        res.json({
          success: true,
          stats: dailyStats
        });
      } catch (error) {
        console.error('Ошибка при получении ежедневной статистики:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Маршрут для получения активных позиций
    this.app.get('/api/positions/active', async (req, res) => {
      try {
        const autoTrader = this.core.getModule('auto-trader');
        
        if (!autoTrader) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль автотрейдинга не найден' 
          });
        }
        
        const positions = autoTrader.getOpenPositions();
        
        res.json({
          success: true,
          positions
        });
      } catch (error) {
        console.error('Ошибка при получении активных позиций:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    this.app.get('/api/positions/history', async (req, res) => {
      try {
        const autoTrader = this.core.getModule('auto-trader');
        
        if (!autoTrader) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль автотрейдинга не найден' 
          });
        }
        
        const history = autoTrader.getPositionHistory();
        
        res.json({
          success: true,
          positions: history
        });
      } catch (error) {
        console.error('Ошибка при получении истории позиций:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Маршрут для получения балансов
    this.app.get('/api/balances', async (req, res) => {
      try {
        let exchange;
        try {
          exchange = this.core.getActiveExchangeConnector();
        } catch (error) {
          return res.status(404).json({ 
            success: false, 
            error: `Не удалось получить коннектор биржи: ${error.message}` 
          });
        }
        
        // Проверяем, есть ли метод получения балансов
        if (!exchange || typeof exchange.getAccountBalance !== 'function') {
          return res.status(404).json({ 
            success: false, 
            error: 'Метод получения балансов не найден' 
          });
        }
        
        const balances = await exchange.getAccountBalance();
        
        res.json({
          success: true,
          balances
        });
      } catch (error) {
        console.error('Ошибка при получении балансов:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // Исполнение сигналов через модуль автотрейдинга
    this.app.post('/api/execute-signal', async (req, res) => {
      try {
        const autoTraderModule = this.core.getModule('auto-trader');
        
        if (!autoTraderModule) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль автотрейдинга не найден' 
          });
        }
        
        const result = await autoTraderModule.handleNewSignal(req.body);
        
        res.json({
          ...result
        });
      } catch (error) {
        console.error('Ошибка при исполнении сигнала:', error);
        res.status(500).json({ 
          success: false,
          error: error.message 
        });
      }
    });
  }

// Настройка WebSocket
setupWebSocket() {
  // Отслеживаем клиентов
  const clients = new Set();

  // Хранилище подписок
  const subscriptions = new Map();

  // Интервальное обновление для имитации WebSocket
  const updateIntervals = new Map();

  // Функция получения интервала обновлений на основе интервала графика
  const getUpdateIntervalMs = (interval) => {
    switch (interval) {
      case '1m': return 5000;  // 5 секунд
      case '5m': return 10000; // 10 секунд
      case '15m': return 15000; // 15 секунд
      case '30m': return 20000; // 20 секунд
      case '1h': return 30000; // 30 секунд
      case '4h': return 60000; // 1 минута
      case '1d': return 120000; // 2 минуты
      default: return 30000; // По умолчанию 30 секунд
    }
  };

  // Отправка начального состояния при подключении клиента
  const sendInitialStateToClient = (ws) => {
    const moduleInfo = this.loadedModules.map(moduleId => {
      const module = this.core.getModule(moduleId);
      return {
        id: moduleId,
        name: module?.name || moduleId,
        description: module?.description || ''
      };
    });
    
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      payload: {
        exchange: this.core.config.exchange,
        tradingPair: this.core.config.tradingPair,
        modules: moduleInfo,
        serverTime: Date.now()
      }
    }));
  };

  // Обработка подписки на график
  const handleChartSubscription = (ws, payload) => {
    const { symbol, interval } = payload;
    
    if (!symbol || !interval) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Неверные параметры подписки на график',
        timestamp: Date.now()
      }));
      return;
    }
    
    // Создаем канал для подписки
    const channel = `chart_${symbol}_${interval}`;
    
    // Сохраняем подписку
    if (!subscriptions.has(channel)) {
      subscriptions.set(channel, new Set());
    }
    
    subscriptions.get(channel).add(ws);
    
    console.log(`Клиент подписан на обновления графика ${symbol} (${interval})`);
    
    // Подтверждаем подписку
    ws.send(JSON.stringify({
      type: 'SUBSCRIPTION_CONFIRMED',
      channel,
      timestamp: Date.now()
    }));
    
    // Настраиваем обновления графика от биржи через WebSocket (если возможно)
    setupExchangeWebSocketForChart(symbol, interval, channel);
  };

  // Обработка отписки от графика
  const handleChartUnsubscription = (ws, payload) => {
    const { symbol, interval } = payload;
    const channel = `chart_${symbol}_${interval}`;
    
    // Удаляем подписку
    if (subscriptions.has(channel)) {
      subscriptions.get(channel).delete(ws);
      
      // Если нет больше подписчиков, удаляем канал
      if (subscriptions.get(channel).size === 0) {
        subscriptions.delete(channel);
        
        // Прекращаем получение обновлений от биржи
        cleanupExchangeWebSocketForChart(symbol, interval);
      }
    }
    
    console.log(`Клиент отписался от обновлений графика ${symbol} (${interval})`);
  };

  // Настройка WebSocket соединения с биржей для получения обновлений свечей
  const setupExchangeWebSocketForChart = (symbol, interval, channel) => {
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Если есть метод для подписки на WebSocket обновления свечей, используем его
      if (typeof exchange.subscribeToKlineStream === 'function') {
        exchange.subscribeToKlineStream(symbol, interval, (candleData) => {
          // Отправляем обновления всем подписчикам канала
          if (subscriptions.has(channel)) {
            const subscribers = subscriptions.get(channel);
            
            // Формируем сообщение
            const message = JSON.stringify({
              type: 'CHART_UPDATE',
              symbol: symbol,
              interval: interval,
              candle: candleData,
              timestamp: Date.now()
            });
            
            // Отправляем всем подписчикам
            for (const subscriber of subscribers) {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(message);
              }
            }
          }
        });
      } else {
        // Если WebSocket API биржи недоступно, настраиваем имитацию через интервал
        setupChartUpdateInterval(symbol, interval, channel);
      }
    } catch (error) {
      console.error(`Ошибка настройки WebSocket для графика ${symbol} (${interval}):`, error);
      // Настраиваем имитацию
      setupChartUpdateInterval(symbol, interval, channel);
    }
  };

  // Создание интервала для имитации обновлений в реальном времени
  const setupChartUpdateInterval = (symbol, interval, channel) => {
    // Определяем интервал обновления на основе выбранного интервала графика
    const intervalMs = getUpdateIntervalMs(interval);
    
    // Создаем интервал для имитации обновлений в реальном времени
    const intervalId = setInterval(async () => {
      try {
        // Если нет подписчиков, останавливаем интервал
        if (!subscriptions.has(channel) || subscriptions.get(channel).size === 0) {
          clearInterval(intervalId);
          updateIntervals.delete(channel);
          return;
        }
        
        // Получаем актуальные данные по паре
        const charts = await this.core.getChartData({
          symbol: symbol,
          interval: interval,
          limit: 1  // Получаем только последнюю свечу
        });
        
        // Если получили данные, отправляем их подписчикам
        if (charts && charts.length > 0) {
          const latestCandle = charts[0];
          
          // Отправляем обновления всем подписчикам канала
          const subscribers = subscriptions.get(channel);
          
          // Формируем сообщение
          const message = JSON.stringify({
            type: 'CHART_UPDATE',
            symbol: symbol,
            interval: interval,
            candle: latestCandle,
            timestamp: Date.now()
          });
          
          // Отправляем всем подписчикам
          for (const subscriber of subscribers) {
            if (subscriber.readyState === WebSocket.OPEN) {
              subscriber.send(message);
            }
          }
        }
      } catch (error) {
        console.error(`Ошибка при получении обновлений для ${symbol} (${interval}):`, error);
      }
    }, intervalMs);
    
    // Сохраняем интервал для возможности очистки
    updateIntervals.set(channel, intervalId);
  };

  // Очистка ресурсов для WebSocket обновлений графика
  const cleanupExchangeWebSocketForChart = (symbol, interval) => {
    const channel = `chart_${symbol}_${interval}`;
    
    // Останавливаем интервал обновлений, если он был создан
    if (updateIntervals.has(channel)) {
      clearInterval(updateIntervals.get(channel));
      updateIntervals.delete(channel);
    }
    
    // Если используется WebSocket API биржи, нужно отписаться от обновлений
    try {
      const exchange = this.core.getActiveExchangeConnector();
      
      if (typeof exchange.unsubscribeFromKlineStream === 'function') {
        exchange.unsubscribeFromKlineStream(symbol, interval);
      }
    } catch (error) {
      console.error(`Ошибка при отписке от обновлений WebSocket для ${symbol} (${interval}):`, error);
    }
  };

  // Обработка подключений WebSocket
  this.wss.on('connection', (ws) => {
    console.log('Новое WebSocket подключение');
    clients.add(ws);
    
    // Обработка сообщений от клиента
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Обработка различных типов сообщений
        switch (data.type) {
          case 'PING':
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            break;
          
          case 'GET_INITIAL_STATE':
            // Отправляем начальное состояние
            sendInitialStateToClient(ws);
            break;
          
          case 'SUBSCRIBE_TO_CHART':
            // Подписка на обновления графика
            handleChartSubscription(ws, data.payload);
            break;
          
          case 'UNSUBSCRIBE_FROM_CHART':
            // Отписка от обновлений графика
            handleChartUnsubscription(ws, data.payload);
            break;
            
          // Добавленные обработчики для других типов сообщений
          case 'SET_EXCHANGE':
            this.handleSetExchange(ws, data.payload);
            break;
          case 'SET_TRADING_PAIR':
            this.handleSetTradingPair(ws, data.payload);
            break;
          case 'SUBSCRIBE_TO_POSITIONS':
            this.handleSubscribeToPositions(ws);
            break;
          case 'SUBSCRIBE_TO_SIGNALS':
            this.handleSubscribeToSignals(ws);
            break;
          case 'SUBSCRIBE_TO_SMART_GRID':
            this.handleSubscribeToSmartGrid(ws);
            break;
          default:
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Неизвестный тип сообщения',
              timestamp: Date.now()
            }));
        }
      } catch (error) {
        console.error('Ошибка обработки WebSocket сообщения:', error);
      }
    });
    
    // Обработка закрытия соединения
    ws.on('close', () => {
      console.log('WebSocket соединение закрыто');
      clients.delete(ws);
      
      // Очищаем подписки для этого клиента
      for (const [channel, subscribers] of subscriptions.entries()) {
        subscribers.delete(ws);
        
        // Если нет больше подписчиков, удаляем канал
        if (subscribers.size === 0) {
          subscriptions.delete(channel);
        }
      }
      
      // Отписываемся от всех подписок для этого клиента (оригинальный код)
      if (ws._chartSubscription) {
        const exchange = this.core.getActiveExchangeConnector();
        if (exchange && typeof exchange.unsubscribeFromStream === 'function') {
          exchange.unsubscribeFromStream(ws._chartSubscription);
        }
      }
    });
    
    // Отправляем приветственное сообщение
    ws.send(JSON.stringify({
      type: 'WELCOME',
      message: 'Соединение с WebSocket установлено',
      timestamp: Date.now()
    }));
  });

  // Экспортируем функцию для использования в других методах
  this.broadcastChartUpdate = (symbol, interval, candleData) => {
    const channel = `chart_${symbol}_${interval}`;
    
    if (subscriptions.has(channel)) {
      const subscribers = subscriptions.get(channel);
      
      // Формируем сообщение
      const message = JSON.stringify({
        type: 'CHART_UPDATE',
        symbol: symbol,
        interval: interval,
        candle: candleData,
        timestamp: Date.now()
      });
      
      // Отправляем всем подписчикам
      for (const subscriber of subscribers) {
        if (subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(message);
        }
      }
    }
  };
}

  // Обработчики событий WebSocket для дополнительных функций

  // Обработка запроса на изменение биржи
  handleSetExchange(ws, payload) {
    if (!payload || !payload.exchange) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Не указана биржа',
        timestamp: Date.now()
      }));
      return;
    }
    
    try {
      // Применяем изменение биржи
      this.core.setActiveExchange(payload.exchange);
      
      // Отправляем подтверждение
      ws.send(JSON.stringify({
        type: 'EXCHANGE_UPDATED',
        payload: {
          exchange: payload.exchange,
          timestamp: Date.now()
        }
      }));
      
      // Уведомляем всех клиентов об изменении биржи
      this.broadcastEvent('EXCHANGE_CHANGED', {
        exchange: payload.exchange,
        timestamp: Date.now()
      });
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Ошибка изменения биржи: ${error.message}`,
        timestamp: Date.now()
      }));
    }
  }

  // Обработка запроса на изменение торговой пары
  handleSetTradingPair(ws, payload) {
    if (!payload || !payload.pair) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Не указана торговая пара',
        timestamp: Date.now()
      }));
      return;
    }
    
    try {
      // Применяем изменение торговой пары
      this.core.setTradingPair(payload.pair);
      
      // Отправляем подтверждение
      ws.send(JSON.stringify({
        type: 'TRADING_PAIR_UPDATED',
        payload: {
          pair: payload.pair,
          timestamp: Date.now()
        }
      }));
      
      // Уведомляем всех клиентов об изменении торговой пары
      this.broadcastEvent('TRADING_PAIR_CHANGED', {
        pair: payload.pair,
        timestamp: Date.now()
      });
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: `Ошибка изменения торговой пары: ${error.message}`,
        timestamp: Date.now()
      }));
    }
  }

  // Обработка подписки на позиции
  handleSubscribeToPositions(ws) {
    ws._positionsSubscribed = true;
    
    // Отправляем текущие позиции
    try {
      const autoTrader = this.core.getModule('auto-trader');
      if (autoTrader) {
        const positions = autoTrader.getOpenPositions();
        
        ws.send(JSON.stringify({
          type: 'POSITIONS_UPDATE',
          payload: positions,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Ошибка при получении открытых позиций:', error);
    }
    
    // Подтверждаем подписку
    ws.send(JSON.stringify({
      type: 'SUBSCRIPTION_CONFIRMED',
      channel: 'positions',
      timestamp: Date.now()
    }));
  }

  // Обработка подписки на сигналы
  handleSubscribeToSignals(ws) {
    ws._signalsSubscribed = true;
    
    // Отправляем последние сигналы (если есть)
    try {
      const signalProcessor = this.core.getModule('signal-processor');
      if (signalProcessor) {
        const recentSignals = signalProcessor.getRecentSignals();
        
        ws.send(JSON.stringify({
          type: 'RECENT_SIGNALS',
          payload: recentSignals,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Ошибка при получении последних сигналов:', error);
    }
    
    // Подтверждаем подписку
    ws.send(JSON.stringify({
      type: 'SUBSCRIPTION_CONFIRMED',
      channel: 'signals',
      timestamp: Date.now()
    }));
  }

  // Обработка подписки на Smart Grid
  handleSubscribeToSmartGrid(ws) {
    ws._smartGridSubscribed = true;
    
    // Отправляем текущие сетки
    try {
      const smartGrid = this.core.getModule('adaptive-smart-grid');
      if (smartGrid) {
        const grids = smartGrid.getActiveGrids();
        
        ws.send(JSON.stringify({
          type: 'SMART_GRID_UPDATE',
          payload: grids,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Ошибка при получении активных сеток:', error);
    }
    
    // Подтверждаем подписку
    ws.send(JSON.stringify({
      type: 'SUBSCRIPTION_CONFIRMED',
      channel: 'smart_grid',
      timestamp: Date.now()
    }));
  }

  // Трансляция события всем подключенным клиентам
  broadcastEvent(eventType, payload) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: eventType,
            payload
          }));
        } catch (error) {
          console.error(`Ошибка при отправке события ${eventType}:`, error);
        }
      }
    });
  }

  // Трансляция обновления позиций подписанным клиентам
  broadcastPositionsUpdate(positions) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client._positionsSubscribed) {
        try {
          client.send(JSON.stringify({
            type: 'POSITIONS_UPDATE',
            payload: positions
          }));
        } catch (error) {
          console.error('Ошибка при отправке обновления позиций:', error);
        }
      }
    });
  }

  // Трансляция нового сигнала подписанным клиентам
  broadcastSignal(signal) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client._signalsSubscribed) {
        try {
          client.send(JSON.stringify({
            type: 'SIGNAL_RECEIVED',
            payload: signal
          }));
        } catch (error) {
          console.error('Ошибка при отправке сигнала:', error);
        }
      }
    });
  }

  // Трансляция обновления Smart Grid подписанным клиентам
  broadcastSmartGridUpdate(grids) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client._smartGridSubscribed) {
        try {
          client.send(JSON.stringify({
            type: 'SMART_GRID_UPDATE',
            payload: grids
          }));
        } catch (error) {
          console.error('Ошибка при отправке обновления Smart Grid:', error);
        }
      }
    });
  }

  // Загрузка модулей из конфигурации
  async loadModules() {
    console.log('Загрузка модулей...');
    
    // Проверяем наличие директории с модулями
    const modulesDir = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesDir)) {
      console.log('Директория с модулями не найдена, создаем...');
      fs.mkdirSync(modulesDir, { recursive: true });
    }
    
    // Загружаем базовые модули сначала
    
    // 1. Загружаем менеджер индикаторов
    try {
      const IndicatorsManager = require('./modules/indicators-manager');
      const indicatorsManager = new IndicatorsManager(config.indicators || {});
      this.core.registerModule('indicators-manager', indicatorsManager);
      this.loadedModules.push('indicators-manager');
      console.log('Модуль менеджера индикаторов успешно загружен');
    } catch (error) {
      console.error('Ошибка загрузки менеджера индикаторов:', error);
    }
    
    // 2. Загружаем менеджер графика
    try {
      const ChartManager = require('./modules/chart-manager');
      const chartManager = new ChartManager(config.chart || {});
      this.core.registerModule('chart-manager', chartManager);
      this.loadedModules.push('chart-manager');
      console.log('Модуль менеджера графика успешно загружен');
    } catch (error) {
      console.error('Ошибка загрузки менеджера графика:', error);
    }
    
    // Получаем список всех модулей, которые нужно загрузить из конфигурации
    const modulesToLoad = config.modules || [];
    
    for (const moduleConfig of modulesToLoad) {
      try {
        // Пропускаем отключенные модули
        if (moduleConfig.enabled === false) {
          console.log(`Модуль ${moduleConfig.id} отключен, пропускаем загрузку`);
          continue;
        }
        
        // Пропускаем уже загруженные базовые модули
        if (this.loadedModules.includes(moduleConfig.id)) {
          console.log(`Модуль ${moduleConfig.id} уже загружен`);
          continue;
        }
        
        const { id, path: modulePath, config: moduleOptions } = moduleConfig;
        
        // Путь к модулю - относительный или абсолютный
        const fullModulePath = path.isAbsolute(modulePath)
          ? modulePath
          : path.join(__dirname, modulePath);
        
        // Загружаем модуль
        const ModuleClass = require(fullModulePath);
        const moduleInstance = new ModuleClass(moduleOptions || this.getModuleConfig(id));
        
        // Регистрируем модуль в ядре
        this.core.registerModule(id, moduleInstance);
        this.loadedModules.push(id);
        
        console.log(`Модуль ${id} успешно загружен`);
      } catch (error) {
        console.error(`Ошибка загрузки модуля ${moduleConfig.id}:`, error.message);
        console.error(error.stack);
      }
    }
    
    console.log(`Загружено модулей: ${this.loadedModules.length}`);
    
    // Настраиваем обработчики событий для трансляции через WebSocket
    this.setupEventHandlers();
  }

  // Получение конфигурации для модуля из общего конфига
  getModuleConfig(moduleId) {
    switch (moduleId) {
      case 'trading-analytics':
        return config.analytics || {};
      case 'auto-trader':
        return {
          ...config.trading,
          ...config.risk
        };
      case 'ai-analyzer':
        return config.aiAnalyzer || {};
      case 'adaptive-smart-grid':
        return config.adaptiveSmartGrid || {};
      default:
        return {};
    }
  }

  // Настройка обработчиков событий для WebSocket
  setupEventHandlers() {
    // Подписка на события ядра для трансляции через WebSocket
    this.core.on('trading-signal', (data) => {
      this.broadcastSignal(data.signal);
    });
    
    // События позиций
    this.core.on('position.opened', (data) => {
      // Обновляем список позиций и отправляем клиентам
      const autoTrader = this.core.getModule('auto-trader');
      if (autoTrader) {
        const positions = autoTrader.getOpenPositions();
        this.broadcastPositionsUpdate(positions);
      }
    });
    
    this.core.on('position.closed', (data) => {
      // Обновляем список позиций и отправляем клиентам
      const autoTrader = this.core.getModule('auto-trader');
      if (autoTrader) {
        const positions = autoTrader.getOpenPositions();
        this.broadcastPositionsUpdate(positions);
      }
    });
    
    // События Smart Grid
    this.core.on('grid.created', (data) => {
      // Обновляем список сеток и отправляем клиентам
      const smartGrid = this.core.getModule('adaptive-smart-grid');
      if (smartGrid) {
        const grids = smartGrid.getActiveGrids();
        this.broadcastSmartGridUpdate(grids);
      }
    });
    
    this.core.on('grid.completed', (data) => {
      // Обновляем список сеток и отправляем клиентам
      const smartGrid = this.core.getModule('adaptive-smart-grid');
      if (smartGrid) {
        const grids = smartGrid.getActiveGrids();
        this.broadcastSmartGridUpdate(grids);
      }
    });
  }

  // Регистрация API эндпоинтов модулей
  registerModuleApiEndpoints() {
    console.log('Регистрация API эндпоинтов модулей...');
    
    this.loadedModules.forEach(moduleId => {
      const moduleInstance = this.core.getModule(moduleId);
      
      // Проверяем, есть ли у модуля метод для регистрации API эндпоинтов
      if (moduleInstance && typeof moduleInstance.registerApiEndpoints === 'function') {
        try {
          moduleInstance.registerApiEndpoints(this.app);
          console.log(`API эндпоинты модуля ${moduleId} успешно зарегистрированы`);
        } catch (error) {
          console.error(`Ошибка при регистрации API эндпоинтов модуля ${moduleId}:`, error);
        }
      }
    });
  }

  // Запуск сервера
  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
      console.log(`Веб-интерфейс доступен по адресу: http://localhost:${port}`);
    });
    
    // Обработка ошибок сервера
    this.server.on('error', (error) => {
      console.error('Ошибка сервера:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Порт ${port} уже используется. Попробуйте другой порт.`);
        process.exit(1);
      }
    });
  }
}

module.exports = TradingApp;