// core.js - Улучшенное ядро торговой системы

/**
 * Главное ядро торговой системы.
 * Управляет модулями, коннекторами к биржам и системой событий.
 */
class TradingCore {
  /**
   * Создает новый экземпляр ядра торговой системы
   */
  constructor() {
    // Хранилище подключенных модулей
    this.modules = {};
    
    // Базовая конфигурация
    this.config = {
      exchange: null,
      tradingPair: null,
      apiKeys: {},
      loggingLevel: 'info', // 'debug', 'info', 'warn', 'error'
      defaultTimeframe: '1h',
      defaultHistoryLimit: 1000
    };
    
    // Коннекторы к биржам
    this.exchangeConnectors = {};
    
    // Флаг инициализации
    this.isInitialized = false;
    
    // Система событий
    this.eventListeners = {};

    // Кэш данных аккаунта для уменьшения количества запросов к API
    this.accountDataCache = {
      balance: null,
      lastUpdate: 0,
      cacheTTL: 60000 // 60 секунд
    };
    
    // Функция для логирования (с возможностью замены)
    this.logger = this._defaultLogger;
  }

  /**
   * Инициализация ядра
   * @param {Object} config - Конфигурация ядра
   * @returns {Promise<boolean>} - Результат инициализации
   * @throws {Error} Если не указана биржа для подключения
   */
  async initialize(config) {
    try {
      this.logger('info', "Инициализация ядра торговой системы...");
      this.config = { ...this.config, ...config };
      
      // Конфигурируем логгер в зависимости от настроек
      this._configureLogger();
      
      // Проверяем наличие необходимых параметров
      if (!this.config.exchange) {
        throw new Error("Не указана биржа для подключения");
      }
      
      // Загружаем коннектор к бирже
      await this.loadExchangeConnector(this.config.exchange)
        .catch(err => {
          this.logger('error', `Не удалось загрузить коннектор к бирже: ${err.message}`);
          throw err;
        });
      
      // Инициализируем уже загруженные модули
      await this.initializeModules()
        .catch(err => {
          this.logger('warn', `Ошибка при инициализации некоторых модулей: ${err.message}`);
          // Продолжаем работу, даже если некоторые модули не инициализировались
        });
      
      this.isInitialized = true;
      
      // Оповещаем о завершении инициализации
      this.emit('core.initialized', { timestamp: Date.now() });
      
      this.logger('info', "Ядро инициализировано успешно");
      return true;
    } catch (error) {
      this.logger('error', `Ошибка инициализации ядра: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Настройка логгера на основе конфигурации
   * @private
   */
  _configureLogger() {
    // В реальном проекте здесь может быть более сложная логика
    // для настройки уровня логирования и форматирования
    const level = this.config.loggingLevel || 'info';
    
    // Определяем уровни логирования
    const logLevels = {
      'debug': 0,
      'info': 1,
      'warn': 2, 
      'error': 3
    };
    
    // Настраиваем логгер, чтобы он фильтровал сообщения по уровню
    this.logger = (messageLevel, message, data) => {
      if (logLevels[messageLevel] >= logLevels[level]) {
        this._defaultLogger(messageLevel, message, data);
      }
    };
  }

  /**
   * Логгер по умолчанию
   * @param {string} level - Уровень логирования (debug, info, warn, error)
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @private
   */
  _defaultLogger(level, message, data) {
    const timestamp = new Date().toISOString();
    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
        break;
      case 'info':
        console.log(`[${timestamp}] [INFO] ${message}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}`);
        break;
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}`);
        if (data) console.error(data);
        break;
      default:
        console.log(`[${timestamp}] ${message}`);
    }
  }

  /**
   * Инициализация уже загруженных модулей
   * @returns {Promise<Array>} - Массив результатов инициализации
   * @private
   */
  async initializeModules() {
    const moduleIds = Object.keys(this.modules);
    
    if (moduleIds.length === 0) {
      this.logger('debug', "Нет модулей для инициализации");
      return [];
    }
    
    this.logger('info', `Инициализация ${moduleIds.length} модулей...`);
    
    const initResults = [];
    
    // Для каждого модуля вызываем метод initialize, но обрабатываем ошибки индивидуально
    for (const moduleId of moduleIds) {
      try {
        const result = await this.modules[moduleId].initialize(this);
        initResults.push({ moduleId, success: true, result });
        this.logger('info', `Модуль ${moduleId} инициализирован`);
      } catch (error) {
        initResults.push({ moduleId, success: false, error });
        this.logger('error', `Ошибка инициализации модуля ${moduleId}: ${error.message}`, error);
      }
    }
    
    // Если все модули завершились с ошибкой, генерируем предупреждение
    if (initResults.every(r => !r.success)) {
      this.logger('warn', "Ни один модуль не был инициализирован успешно");
    }
    
    return initResults;
  }

  /**
   * Загрузка коннектора к бирже
   * @param {string} exchangeName - Имя биржи
   * @returns {Promise<Object>} - Экземпляр коннектора
   * @throws {Error} Если биржа не поддерживается
   */
  async loadExchangeConnector(exchangeName) {
    const exchange = exchangeName.toLowerCase();
    this.logger('info', `Загрузка коннектора к бирже ${exchange}...`);
    
    try {
      let connector;
      
      // Фабрика коннекторов к биржам
      switch (exchange) {
        case 'binance':
          connector = await this._loadConnector('./connectors/binance', exchange);
          break;
        case 'bybit':
          connector = await this._loadConnector('./connectors/bybit', exchange);
          break;
        case 'bitget':
          connector = await this._loadConnector('./connectors/bitget', exchange);
          break;
        case 'mexc':
          connector = await this._loadConnector('./connectors/mexc', exchange);
          break;
        default:
          throw new Error(`Неподдерживаемая биржа: ${exchangeName}`);
      }
      
      // Сохраняем активную биржу в конфигурации
      this.config.activeExchange = exchange;
      
      // Оповещаем о смене биржи
      this.emit('exchange.changed', { exchange });
      
      this.logger('info', `Коннектор к бирже ${exchange} успешно загружен`);
      
      return connector;
    } catch (error) {
      this.logger('error', `Ошибка при загрузке коннектора к бирже ${exchange}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Загрузка коннектора из файла
   * @param {string} connectorPath - Путь к файлу коннектора
   * @param {string} exchange - Имя биржи
   * @returns {Promise<Object>} - Экземпляр коннектора
   * @private
   */
  async _loadConnector(connectorPath, exchange) {
    try {
      const ConnectorClass = require(connectorPath);
      const connector = new ConnectorClass(this.config.apiKeys[exchange] || {});
      this.exchangeConnectors[exchange] = connector;
      
      // Инициализируем коннектор с тайм-аутом для предотвращения зависания
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Превышено время ожидания при инициализации коннектора ${exchange}`)), 30000);
      });
      
      await Promise.race([connector.initialize(), timeoutPromise]);
      
      return connector;
    } catch (error) {
      delete this.exchangeConnectors[exchange];
      throw error;
    }
  }

  /**
   * Получение активного коннектора к бирже
   * @returns {Object} - Экземпляр коннектора
   * @throws {Error} Если ядро не инициализировано или коннектор не найден
   */
  getActiveExchangeConnector() {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    const activeExchange = this.config.activeExchange;
    const connector = this.exchangeConnectors[activeExchange];
    
    if (!connector) {
      throw new Error(`Коннектор для биржи ${activeExchange} не найден`);
    }
    
    return connector;
  }

  /**
   * Установка торговой пары
   * @param {string} pair - Торговая пара (например, "BTCUSDT")
   */
  setTradingPair(pair) {
    if (!pair) {
      this.logger('warn', "Попытка установить пустую торговую пару");
      return;
    }
    
    this.logger('info', `Установка торговой пары: ${pair}`);
    const oldPair = this.config.tradingPair;
    this.config.tradingPair = pair;
    
    // Оповещаем все модули об изменении пары через систему событий
    this.emit('tradingPair.changed', { 
      oldPair, 
      newPair: pair 
    });
  }

  /**
 * Получение данных графика выбранной пары
 * @param {Object} params - Параметры запроса
 * @param {string} [params.symbol] - Символ торговой пары (необязательно, по умолчанию из конфигурации)
 * @param {string} [params.interval] - Интервал (timeframe) (необязательно, по умолчанию из конфигурации)
 * @param {number} [params.limit] - Количество свечей (необязательно, по умолчанию из конфигурации)
 * @param {number} [params.endTime] - Время окончания (необязательно)
 * @returns {Promise<Array>} - Массив свечей
 * @throws {Error} Если ядро не инициализировано или пара не выбрана
 */
async getChartData(params = {}) {
  if (!this.isInitialized) {
    this.logger('warn', "Ядро не инициализировано, возвращаем заглушку");
    return this._generateDemoCandles(params.symbol || 'BTCUSDT', params.interval || '1h', params.limit || 100);
  }
  
  // Применяем значения по умолчанию из конфигурации
  const requestParams = {
    symbol: params.symbol || this.config.tradingPair || 'BTCUSDT',
    interval: params.interval || this.config.defaultTimeframe || '1h',
    limit: params.limit || this.config.defaultHistoryLimit || 100,
    endTime: params.endTime
  };
  
  if (!requestParams.symbol) {
    this.logger('warn', "Не выбрана торговая пара, используем BTCUSDT");
    requestParams.symbol = 'BTCUSDT';
  }
  
  try {
    let exchange;
    try {
      exchange = this.getActiveExchangeConnector();
    } catch (error) {
      this.logger('error', `Не удалось получить активный коннектор: ${error.message}`, error);
      return this._generateDemoCandles(requestParams.symbol, requestParams.interval, requestParams.limit);
    }
    
    if (!exchange || typeof exchange.getChartData !== 'function') {
      this.logger('error', `Коннектор не поддерживает метод getChartData`);
      return this._generateDemoCandles(requestParams.symbol, requestParams.interval, requestParams.limit);
    }
    
    return await exchange.getChartData(requestParams)
      .catch(error => {
        this.logger('error', `Ошибка при получении данных графика: ${error.message}`, error);
        return this._generateDemoCandles(requestParams.symbol, requestParams.interval, requestParams.limit);
      });
  } catch (error) {
    this.logger('error', `Ошибка при получении данных графика: ${error.message}`, error);
    return this._generateDemoCandles(requestParams.symbol, requestParams.interval, requestParams.limit);
  }
}

// Добавим метод для генерации демо-свечей
_generateDemoCandles(symbol, interval, limit) {
  const candles = [];
  const now = new Date().getTime();
  let lastClose = symbol.includes('BTC') ? 45000 + Math.random() * 5000 : 2800 + Math.random() * 300;
  
  // Определение длительности интервала в миллисекундах
  const intervalMap = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  };
  
  const intervalMs = intervalMap[interval] || intervalMap['1h'];
  
  for (let i = limit - 1; i >= 0; i--) {
    const openTime = now - (i * intervalMs);
    const volatility = lastClose * 0.02; // 2% волатильность
    
    const open = lastClose;
    const high = open + (Math.random() * volatility);
    const low = open - (Math.random() * volatility);
    const close = low + (Math.random() * (high - low));
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
}

  /**
   * Получение данных о балансе аккаунта
   * @param {boolean} [forceRefresh=false] - Принудительно обновить данные из API
   * @returns {Promise<Object>} - Данные о балансе
   */
  async getAccountBalance(forceRefresh = false) {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    const currentTime = Date.now();
    
    // Проверяем, есть ли кэшированные данные и не устарели ли они
    if (!forceRefresh && 
        this.accountDataCache.balance && 
        (currentTime - this.accountDataCache.lastUpdate) < this.accountDataCache.cacheTTL) {
      return this.accountDataCache.balance;
    }
    
    try {
      const exchange = this.getActiveExchangeConnector();
      
      // Проверяем наличие API ключей
      if (!this.config.apiKeys[this.config.activeExchange]?.apiKey) {
        throw new Error("Отсутствуют API ключи для текущей биржи");
      }
      
      // Запрашиваем баланс через API биржи
      let balanceData;
      
      if (typeof exchange.getAccountInfo === 'function') {
        const accountInfo = await exchange.getAccountInfo();
        
        // Преобразуем данные в стандартный формат
        balanceData = {
          total: this._calculateTotalBalance(accountInfo),
          available: this._calculateAvailableBalance(accountInfo),
          margin: this._calculateMarginBalance(accountInfo),
          rawData: accountInfo
        };
      } else if (typeof exchange.getBalance === 'function') {
        const balanceInfo = await exchange.getBalance();
        
        // Преобразуем данные в стандартный формат
        balanceData = {
          total: this._calculateTotalFromBalanceInfo(balanceInfo),
          available: this._calculateAvailableFromBalanceInfo(balanceInfo),
          margin: this._calculateMarginFromBalanceInfo(balanceInfo),
          rawData: balanceInfo
        };
      } else {
        throw new Error("API биржи не предоставляет методов для получения баланса");
      }
      
      // Обновляем кэш
      this.accountDataCache.balance = balanceData;
      this.accountDataCache.lastUpdate = currentTime;
      
      return balanceData;
    } catch (error) {
      this.logger('error', `Ошибка при получении данных о балансе: ${error.message}`, error);
      
      // В случае ошибки возвращаем последние известные данные или значения по умолчанию
      if (this.accountDataCache.balance) {
        return this.accountDataCache.balance;
      }
      
      return {
        total: 0,
        available: 0,
        margin: 0,
        error: error.message
      };
    }
  }

  /**
   * Вычисление общего баланса из данных аккаунта
   * @param {Object} accountInfo - Данные аккаунта с биржи
   * @returns {number} - Общий баланс в USD
   * @private
   */
  _calculateTotalBalance(accountInfo) {
    // Адаптировать для каждой биржи
    try {
      // Для Binance
      if (this.config.activeExchange === 'binance') {
        // Получаем балансы из общего объекта аккаунта
        const balances = accountInfo.balances || [];
        
        // Получаем только балансы со значениями > 0
        const nonZeroBalances = balances.filter(b => 
          parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );
        
        // Суммируем free и locked для каждой валюты
        const totalBalance = nonZeroBalances.reduce((total, balance) => {
          const assetTotal = parseFloat(balance.free) + parseFloat(balance.locked);
          
          // Для стейблкоинов (USDT, BUSD, USDC, DAI) считаем напрямую
          if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(balance.asset)) {
            return total + assetTotal;
          }
          
          // Для других активов нужно конвертировать в USD
          // Здесь можно запросить цену через API, но для упрощения используем предварительно полученные цены
          const price = this._getAssetPrice(balance.asset);
          return total + (assetTotal * price);
        }, 0);
        
        return totalBalance;
      }
      
      // Для других бирж реализовать аналогично
      
      // Если не удалось определить, возвращаем 0
      return 0;
    } catch (error) {
      this.logger('error', `Ошибка при расчете общего баланса: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Вычисление доступного баланса из данных аккаунта
   * @param {Object} accountInfo - Данные аккаунта с биржи
   * @returns {number} - Доступный баланс в USD
   * @private
   */
  _calculateAvailableBalance(accountInfo) {
    // Адаптировать для каждой биржи аналогично _calculateTotalBalance
    try {
      // Для Binance
      if (this.config.activeExchange === 'binance') {
        const balances = accountInfo.balances || [];
        
        const availableBalance = balances.reduce((total, balance) => {
          const freeAmount = parseFloat(balance.free);
          
          if (freeAmount <= 0) {
            return total;
          }
          
          if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(balance.asset)) {
            return total + freeAmount;
          }
          
          const price = this._getAssetPrice(balance.asset);
          return total + (freeAmount * price);
        }, 0);
        
        return availableBalance;
      }
      
      return 0;
    } catch (error) {
      this.logger('error', `Ошибка при расчете доступного баланса: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Вычисление маржинального баланса из данных аккаунта
   * @param {Object} accountInfo - Данные аккаунта с биржи
   * @returns {number} - Маржинальный баланс в USD
   * @private
   */
  _calculateMarginBalance(accountInfo) {
    // Адаптировать для каждой биржи аналогично предыдущим методам
    try {
      // Для Binance
      if (this.config.activeExchange === 'binance') {
        const balances = accountInfo.balances || [];
        
        const marginBalance = balances.reduce((total, balance) => {
          const lockedAmount = parseFloat(balance.locked);
          
          if (lockedAmount <= 0) {
            return total;
          }
          
          if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(balance.asset)) {
            return total + lockedAmount;
          }
          
          const price = this._getAssetPrice(balance.asset);
          return total + (lockedAmount * price);
        }, 0);
        
        return marginBalance;
      }
      
      return 0;
    } catch (error) {
      this.logger('error', `Ошибка при расчете маржинального баланса: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Получение цены актива в USD
   * @param {string} asset - Название актива
   * @returns {number} - Цена актива в USD
   * @private
   */
  async _getAssetPrice(asset) {
    try {
      // Если это стейблкоин, возвращаем 1
      if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(asset)) {
        return 1;
      }
      
      const exchange = this.getActiveExchangeConnector();
      
      // Проверяем, есть ли метод getTicker
      if (typeof exchange.getTicker === 'function') {
        // Пробуем получить цену через USDT
        const symbolUsdt = `${asset}USDT`;
        try {
          const tickerUsdt = await exchange.getTicker(symbolUsdt);
          return parseFloat(tickerUsdt.price);
        } catch (error) {
          // Если не удалось через USDT, пробуем через BTC
          const symbolBtc = `${asset}BTC`;
          const tickerBtc = await exchange.getTicker(symbolBtc);
          
          // Получаем цену BTC в USDT
          const tickerBtcUsdt = await exchange.getTicker('BTCUSDT');
          
          // Вычисляем цену актива в USDT через BTC
          return parseFloat(tickerBtc.price) * parseFloat(tickerBtcUsdt.price);
        }
      }
      
      // Если не удалось получить цену, возвращаем 0
      return 0;
    } catch (error) {
      this.logger('error', `Ошибка при получении цены актива ${asset}: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Вычисление общего баланса из данных балансов
   * @param {Object} balanceInfo - Данные о балансах
   * @returns {number} - Общий баланс в USD
   * @private
   */
  _calculateTotalFromBalanceInfo(balanceInfo) {
    // Реализация зависит от формата данных каждой биржи
    try {
      // Пример для общего формата
      let total = 0;
      
      for (const [asset, amount] of Object.entries(balanceInfo)) {
        const assetTotal = parseFloat(amount.total || 0);
        
        if (assetTotal <= 0) {
          continue;
        }
        
        if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(asset)) {
          total += assetTotal;
        } else {
          const price = this._getAssetPrice(asset);
          total += (assetTotal * price);
        }
      }
      
      return total;
    } catch (error) {
      this.logger('error', `Ошибка при расчете общего баланса из balanceInfo: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Вычисление доступного баланса из данных балансов
   * @param {Object} balanceInfo - Данные о балансах
   * @returns {number} - Доступный баланс в USD
   * @private
   */
  _calculateAvailableFromBalanceInfo(balanceInfo) {
    // Реализация по аналогии с _calculateTotalFromBalanceInfo
    try {
      let available = 0;
      
      for (const [asset, amount] of Object.entries(balanceInfo)) {
        const assetAvailable = parseFloat(amount.free || amount.available || 0);
        
        if (assetAvailable <= 0) {
          continue;
        }
        
        if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(asset)) {
          available += assetAvailable;
        } else {
          const price = this._getAssetPrice(asset);
          available += (assetAvailable * price);
        }
      }
      
      return available;
    } catch (error) {
      this.logger('error', `Ошибка при расчете доступного баланса из balanceInfo: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Вычисление маржинального баланса из данных балансов
   * @param {Object} balanceInfo - Данные о балансах
   * @returns {number} - Маржинальный баланс в USD
   * @private
   */
  _calculateMarginFromBalanceInfo(balanceInfo) {
    // Реализация по аналогии с предыдущими методами
    try {
      let margin = 0;
      
      for (const [asset, amount] of Object.entries(balanceInfo)) {
        const assetLocked = parseFloat(amount.locked || amount.used || 0);
        
        if (assetLocked <= 0) {
          continue;
        }
        
        if (['USDT', 'BUSD', 'USDC', 'DAI'].includes(asset)) {
          margin += assetLocked;
        } else {
          const price = this._getAssetPrice(asset);
          margin += (assetLocked * price);
        }
      }
      
      return margin;
    } catch (error) {
      this.logger('error', `Ошибка при расчете маржинального баланса из balanceInfo: ${error.message}`, error);
      return 0;
    }
  }

  /**
   * Регистрация модуля в системе
   * @param {string} moduleId - Идентификатор модуля
   * @param {Object} moduleInstance - Экземпляр модуля
   * @returns {boolean} - Результат регистрации
   * @throws {Error} Если модуль не реализует необходимый интерфейс
   */
  registerModule(moduleId, moduleInstance) {
    try {
      this.logger('info', `Регистрация модуля: ${moduleId}`);
      
      // Проверяем, что модуль реализует необходимый интерфейс
      if (typeof moduleInstance.initialize !== 'function') {
        throw new Error(`Модуль ${moduleId} не реализует метод initialize`);
      }
      
      // Проверяем, не зарегистрирован ли уже модуль с таким ID
      if (this.modules[moduleId]) {
        this.logger('warn', `Модуль с ID ${moduleId} уже зарегистрирован и будет перезаписан`);
      }
      
      this.modules[moduleId] = moduleInstance;
      
      // Если ядро уже инициализировано, инициализируем и модуль
      if (this.isInitialized) {
        moduleInstance.initialize(this)
          .then(() => {
            this.logger('info', `Модуль ${moduleId} успешно инициализирован`);
            this.emit('module.registered', { moduleId });
          })
          .catch(error => {
            this.logger('error', `Ошибка инициализации модуля ${moduleId}: ${error.message}`, error);
          });
      }
      
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при регистрации модуля ${moduleId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получение модуля по ID
   * @param {string} moduleId - Идентификатор модуля
   * @returns {Object|null} - Экземпляр модуля или null, если модуль не найден
   */
  getModule(moduleId) {
    const module = this.modules[moduleId] || null;
    
    if (!module) {
      this.logger('debug', `Запрошен несуществующий модуль: ${moduleId}`);
    }
    
    return module;
  }

  /**
   * Проверка, загружен ли модуль
   * @param {string} moduleId - Идентификатор модуля
   * @returns {boolean} - true, если модуль загружен
   */
  hasModule(moduleId) {
    return moduleId in this.modules;
  }

  /**
   * Выгрузка модуля из системы
   * @param {string} moduleId - Идентификатор модуля
   * @returns {Promise<boolean>} - Результат выгрузки
   */
  async unregisterModule(moduleId) {
    this.logger('info', `Выгрузка модуля: ${moduleId}`);
    
    if (!this.hasModule(moduleId)) {
      this.logger('warn', `Модуль ${moduleId} не найден`);
      return false;
    }
    
    try {
      // Вызываем метод cleanup модуля, если он есть
      if (typeof this.modules[moduleId].cleanup === 'function') {
        await this.modules[moduleId].cleanup();
      }
      
      delete this.modules[moduleId];
      
      // Оповещаем о выгрузке модуля
      this.emit('module.unregistered', { moduleId });
      
      this.logger('info', `Модуль ${moduleId} успешно выгружен`);
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при выгрузке модуля ${moduleId}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Динамическая загрузка модуля по пути к файлу
   * @param {Object} moduleConfig - Конфигурация модуля
   * @param {string} moduleConfig.id - Идентификатор модуля
   * @param {string} moduleConfig.path - Путь к файлу модуля
   * @param {Object} [moduleConfig.config] - Конфигурация модуля
   * @returns {Promise<boolean>} - Результат загрузки
   */
  async loadModule(moduleConfig) {
    try {
      const { id, path: modulePath, config } = moduleConfig;
      
      if (!id || !modulePath) {
        throw new Error("Неверная конфигурация модуля: отсутствует id или path");
      }
      
      this.logger('info', `Загрузка модуля из файла: ${modulePath}`);
      
      // Загружаем класс модуля
      let ModuleClass;
      try {
        ModuleClass = require(modulePath);
      } catch (error) {
        throw new Error(`Не удалось загрузить файл модуля ${modulePath}: ${error.message}`);
      }
      
      // Создаем экземпляр модуля
      const moduleInstance = new ModuleClass(config || {});
      
      // Регистрируем модуль
      this.registerModule(id, moduleInstance);
      
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при загрузке модуля: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Подписка на событие
   * @param {string} eventType - Тип события
   * @param {Function} callback - Функция-обработчик события
   * @returns {TradingCore} - this для цепочки вызовов
   */
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    
    this.eventListeners[eventType].push(callback);
    return this; // Для цепочки вызовов
  }
  
  /**
   * Отписка от события
   * @param {string} eventType - Тип события
   * @param {Function} [callback] - Функция-обработчик события (если не указана, удаляются все обработчики)
   * @returns {TradingCore} - this для цепочки вызовов
   */
  off(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      return this; // Нет слушателей для этого типа события
    }
    
    // Если callback не указан, удаляем все слушатели для этого типа события
    if (!callback) {
      delete this.eventListeners[eventType];
      return this;
    }
    
    // Удаляем конкретный callback
    this.eventListeners[eventType] = this.eventListeners[eventType]
      .filter(listener => listener !== callback);
    
    return this;
  }
  
  /**
   * Публикация события
   * @param {string} eventType - Тип события
   * @param {Object} [eventData={}] - Данные события
   * @returns {boolean} - Результат публикации (true, если были слушатели)
   */
  emit(eventType, eventData = {}) {
    // Добавляем метаданные события
    eventData.eventType = eventType;
    eventData.timestamp = eventData.timestamp || Date.now();
    
    // Логируем событие
    if (eventType !== 'log') { // Предотвращаем рекурсию
      this.logger('debug', `Событие: ${eventType}`, eventData);
    }
    
    // Если нет слушателей, просто выходим
    if (!this.eventListeners[eventType] || this.eventListeners[eventType].length === 0) {
      return false;
    }
    
    // Вызываем всех слушателей
    let hasErrors = false;
    this.eventListeners[eventType].forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        hasErrors = true;
        this.logger('error', `Ошибка в обработчике события ${eventType}: ${error.message}`, error);
      }
    });
    
    if (hasErrors) {
      this.logger('warn', `Возникли ошибки при обработке события ${eventType}`);
    }
    
    return true;
  }
  
  /**
   * Одноразовая подписка на событие
   * @param {string} eventType - Тип события
   * @param {Function} callback - Функция-обработчик события
   * @returns {TradingCore} - this для цепочки вызовов
   */
  once(eventType, callback) {
    const onceCallback = (eventData) => {
      // Отписываемся сразу после первого вызова
      this.off(eventType, onceCallback);
      // Вызываем оригинальный callback
      callback(eventData);
    };
    
    this.on(eventType, onceCallback);
    return this;
  }
  /**
   * Получить коннектор к бирже по имени
   * @param {string} exchange - Имя биржи (например, 'binance', 'bitget')
   * @returns {object|null} - Коннектор к бирже или null
   */
  getExchangeConnector(exchange) {
    if (!exchange) return null;
    const ex = exchange.toLowerCase();
    return this.exchangeConnectors[ex] || null;
  }
}

module.exports = TradingCore;