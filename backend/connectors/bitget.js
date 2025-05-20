// connectors/bitget.js - Улучшенный коннектор к бирже Bitget для API v2

const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');

/**
 * Полноценный коннектор к бирже Bitget (API v2)
 * Поддерживает работу как со спотовым, так и с фьючерсным рынком
 * Документация API v2: https://bitgetlimited.github.io/apidoc/en/spot/v2-1-0-0.html
 */
class BitgetConnector {
  /**
   * Создание нового экземпляра коннектора Bitget
   * @param {Object} apiConfig - Конфигурация API ключей и параметров
   */
  constructor(apiConfig = {}) {
    this.apiKey = apiConfig.apiKey || '';
    this.secretKey = apiConfig.secretKey || '';
    this.passphrase = apiConfig.passphrase || ''; // Bitget требует passphrase
    
    // URL для API запросов v2
    this.baseUrl = apiConfig.endpoints && apiConfig.endpoints.spot || 'https://api.bitget.com';
    this.futuresBaseUrl = apiConfig.endpoints && apiConfig.endpoints.futures || 'https://api.bitget.com';
    this.wsBaseUrl = 'wss://ws.bitget.com/mix/v1/stream';
    
    // Таймауты и настройки запросов
    this.requestTimeout = apiConfig.requestTimeout || 10000; // 10 секунд по умолчанию
    this.recvWindow = apiConfig.recvWindow || 5000; // 5 секунд по умолчанию
    
    // Режим тестовой сети
    this.testnet = apiConfig.testnet || false;
    if (this.testnet) {
      console.warn('Коннектор Bitget запущен в режиме тестовой сети');
      this.baseUrl = 'https://api-demo.bitget.com';
      this.futuresBaseUrl = 'https://api-demo.bitget.com';
      this.wsBaseUrl = 'wss://ws-demo.bitget.com/mix/v1/stream';
    }
    
    // HTTP клиент с настройками по умолчанию для спотового рынка
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // HTTP клиент для фьючерсного рынка
    this.futuresHttpClient = axios.create({
      baseURL: this.futuresBaseUrl,
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    // WebSocket соединения
    this.wsConnections = {};
    
    // Авторизован ли коннектор
    this.isAuthorized = !!(this.apiKey && this.secretKey && this.passphrase);
    
    // Статус инициализации
    this.isInitialized = false;
    
    // Кеш для информации о рынке
    this.marketCache = {
      spot: null,
      futures: null,
      lastUpdate: 0,
      cacheTTL: 3600000 // 1 час
    };
  }

  /**
   * Инициализация коннектора
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize() {
    try {
      console.log('Инициализация коннектора Bitget...');
      
      // Проверяем подключение, запрашивая публичный метод
      await this.getServerTime();
      
      // Если указаны API ключи, проверяем их валидность
      if (this.isAuthorized) {
        try {
          // Получаем информацию об аккаунте или баланс для проверки ключей
          await this.getAccountInfo();
          console.log('API ключи Bitget успешно валидированы');
        } catch (error) {
          console.warn('Не удалось валидировать API ключи Bitget, продолжаем работу только с публичными методами');
          console.warn('Причина: ' + error.message);
          this.isAuthorized = false;
        }
      } else {
        console.log('API ключи не указаны, работа только с публичными методами');
      }
      
      // Получаем и кешируем информацию о торговых парах
      await this.updateMarketCache();
      
      this.isInitialized = true;
      console.log('Коннектор Bitget успешно инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации коннектора Bitget: ' + error.message);
      throw new Error('Не удалось инициализировать коннектор Bitget: ' + error.message);
    }
  }

  /**
   * Получение времени сервера Bitget API v2
   * @returns {Promise<Object>} - Время сервера
   */
  async getServerTime() {
    try {
      // В API v2 эндпоинт для времени сервера изменен
      const response = await this.publicRequest('/api/spot/v1/public/time', {});
      return {
        serverTime: parseInt(response.data.timestamp || response.data.systemTime || response.data.ts),
        timezone: 'UTC'
      };
    } catch (error) {
      console.error('Ошибка получения времени сервера Bitget: ' + error.message);
      throw error;
    }
  }

  /**
   * Получение информации об аккаунте (для проверки ключей API v2)
   * @returns {Promise<Object>} - Информация об аккаунте
   */
  async getAccountInfo() {
    try {
      // В API v2 используем эндпоинт для получения балансов спот-аккаунта
      const response = await this.privateRequest('GET', '/api/spot/v1/account/assets', null, {});
      return { balances: response.data };
    } catch (error) {
      console.error('Ошибка получения информации об аккаунте Bitget: ' + error.message);
      throw error;
    }
  }

  /**
   * Обновление кеша информации о рынке
   * @returns {Promise<void>}
   */
  async updateMarketCache() {
    const now = Date.now();
    
    // Обновляем кеш, только если истек срок его действия
    if (now - this.marketCache.lastUpdate > this.marketCache.cacheTTL) {
      try {
        // Загружаем информацию о спотовых парах
        const spotResponse = await this.publicRequest('/api/spot/v1/public/products', {});
        if (spotResponse && spotResponse.data) {
          this.marketCache.spot = spotResponse.data;
        }
        
        try {
          // Загружаем информацию о фьючерсных парах
          // Для API v2 используем правильный эндпоинт и параметры
          const futuresResponse = await this.publicRequest('/api/mix/v1/market/contracts', { 
            productType: 'umcbl' // USDT-маржинальные контракты
          });
          
          if (futuresResponse && futuresResponse.data) {
            this.marketCache.futures = futuresResponse.data;
          }
        } catch (futuresError) {
          console.warn('Ошибка при загрузке фьючерсных контрактов:', futuresError.message);
          // Второй вариант: пробуем без указания productType
          try {
            const futuresAltResponse = await this.publicRequest('/api/mix/v1/market/contracts');
            if (futuresAltResponse && futuresAltResponse.data) {
              this.marketCache.futures = futuresAltResponse.data;
            }
          } catch (altError) {
            console.error('Невозможно загрузить данные фьючерсных контрактов:', altError.message);
          }
        }
        
        this.marketCache.lastUpdate = now;
        console.log('Кеш рынков Bitget обновлен. Доступно ' + 
          (this.marketCache.spot ? this.marketCache.spot.length : 0) + ' спотовых пар и ' + 
          (this.marketCache.futures ? this.marketCache.futures.length : 0) + ' фьючерсных контрактов');
      } catch (error) {
        console.error('Ошибка обновления кеша рынков Bitget: ' + error.message);
      }
    }
  }

  /**
   * Выполнение публичного запроса к API
   * @param {string} endpoint - Конечная точка API
   * @param {Object} params - Параметры запроса
   * @returns {Promise<Object>} - Ответ API
   */
  async publicRequest(endpoint, params = {}) {
    try {
      // Если путь не начинается с "/", добавляем его
      if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
      }
      
      console.log('Публичный запрос к эндпоинту: ' + endpoint);
      
      // Определяем, к какому API относится запрос (спот или фьючерсы)
      const isSpotEndpoint = endpoint.includes('/spot/');
      const client = isSpotEndpoint ? this.httpClient : this.futuresHttpClient;
      
      // Выполняем запрос
      const response = await client.get(endpoint, { params });
      
      // Проверяем успешность ответа
      if (response.data && response.data.code && response.data.code !== '00000') {
        throw new Error('API error: ' + (response.data.msg || 'Unknown error'));
      }
      
      return response.data;
    } catch (error) {
      if (error.response) {
        // Обрабатываем ошибку ответа API
        const errorMessage = error.response.data && error.response.data.msg || error.message;
        throw new Error('Bitget API error: ' + errorMessage);
      }
      throw error;
    }
  }

  /**
   * Генерация подписи для запросов API v2
   * @param {string} timestamp - Временная метка
   * @param {string} method - HTTP метод
   * @param {string} requestPath - Путь запроса
   * @param {Object|string} body - Тело запроса (для POST)
   * @returns {string} - Сгенерированная подпись
   */
  generateSignature(timestamp, method, requestPath, body = '') {
    // Для Bitget API подпись формируется как: timestamp + method + requestPath + body
    const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '');
    const message = timestamp + method.toUpperCase() + requestPath + bodyStr;
    
    // Подпись генерируется с использованием HMAC SHA256 и кодируется в base64
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('base64');
  }

  /**
   * Выполнение приватного запроса к API (требует аутентификации)
   * @param {string} method - HTTP метод (GET, POST, DELETE)
   * @param {string} endpoint - Конечная точка API
   * @param {Object} data - Данные запроса для POST
   * @param {Object} params - Параметры запроса для GET
   * @returns {Promise<Object>} - Ответ API
   */
  async privateRequest(method, endpoint, data = null, params = null) {
    if (!this.isAuthorized) {
      throw new Error('API ключи не настроены. Приватные методы недоступны.');
    }
    
    try {
      // Определяем, к какому API относится запрос (спот или фьючерсы)
      const isSpotEndpoint = endpoint.includes('/spot/');
      const client = isSpotEndpoint ? this.httpClient : this.futuresHttpClient;
      
      // Формируем временную метку для запроса (в миллисекундах)
      const timestamp = Date.now().toString();
      
      // Формируем строку запроса для GET параметров
      let queryString = '';
      if (params && Object.keys(params).length > 0) {
        // Сортируем параметры по алфавиту
        const sortedParams = {};
        Object.keys(params).sort().forEach(key => {
          sortedParams[key] = params[key];
        });
        queryString = '?' + new URLSearchParams(sortedParams).toString();
      }
      
      // Полный путь включает endpoint и query string для подписи
      const requestPath = endpoint + queryString;
      
      // Данные для подписи - для GET это пустая строка, для POST это JSON строка
      const bodyStr = method.toUpperCase() === 'POST' ? 
                    (data ? JSON.stringify(data) : '') : '';
      
      // Генерируем подпись для API
      const signature = this.generateSignature(timestamp, method, requestPath, bodyStr);
      
      // Формируем заголовки запроса
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': signature,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase
      };
      
      // Выполняем запрос в зависимости от метода
      let response;
      if (method.toUpperCase() === 'GET') {
        response = await client.get(endpoint, { 
          headers, 
          params
        });
      } else if (method.toUpperCase() === 'POST') {
        response = await client.post(endpoint, data, { 
          headers
        });
      } else if (method.toUpperCase() === 'DELETE') {
        response = await client.delete(endpoint, { 
          headers, 
          data
        });
      }
      
      // Проверка на ошибки в ответе API
      if (response.data && response.data.code && response.data.code !== '00000') {
        throw new Error('API error: ' + (response.data.msg || 'Unknown error'));
      }
      
      return response.data;
    } catch (error) {
      console.error('[ОШИБКА] Bitget API запрос не выполнен:', error);
      if (error.response) {
        // Логируем полную информацию об ошибке для отладки
        console.error('[ОШИБКА] Статус ответа:', error.response.status);
        console.error('[ОШИБКА] Данные ответа:', JSON.stringify(error.response.data));
        
        // Обрабатываем ошибку ответа API
        const errorMessage = error.response.data && error.response.data.msg || error.message;
        throw new Error('Bitget API error: ' + errorMessage);
      }
      throw error;
    }
  }

  /**
   * Получение списка доступных торговых пар (спотовый рынок)
   * @returns {Promise<Array>} - Массив доступных торговых пар
   */
  async getTradingPairs() {
    try {
      // Проверяем, есть ли данные в кеше
      if (!this.marketCache.spot || Date.now() - this.marketCache.lastUpdate > this.marketCache.cacheTTL) {
        await this.updateMarketCache();
      }
      
      // Если есть данные в кеше, используем их
      if (this.marketCache.spot) {
        return this.marketCache.spot.map(symbol => {
          return {
            symbol: symbol.symbolName,
            baseAsset: symbol.baseCoin,
            quoteAsset: symbol.quoteCoin,
            status: symbol.status === 'online' ? 'TRADING' : 'NOT_TRADING',
            minOrderQuantity: parseFloat(symbol.minTradeAmount),
            maxOrderQuantity: parseFloat(symbol.maxTradeAmount),
            pricePrecision: parseInt(symbol.priceScale),
            quantityPrecision: parseInt(symbol.quantityScale),
            marketType: 'spot'
          };
        });
      }
      
      // Если данных нет в кеше, делаем запрос
      const response = await this.publicRequest('/api/spot/v1/public/products');
      
      return response.data.map(symbol => {
        return {
          symbol: symbol.symbolName,
          baseAsset: symbol.baseCoin,
          quoteAsset: symbol.quoteCoin,
          status: symbol.status === 'online' ? 'TRADING' : 'NOT_TRADING',
          minOrderQuantity: parseFloat(symbol.minTradeAmount),
          maxOrderQuantity: parseFloat(symbol.maxTradeAmount),
          pricePrecision: parseInt(symbol.priceScale),
          quantityPrecision: parseInt(symbol.quantityScale),
          marketType: 'spot'
        };
      });
    } catch (error) {
      console.error('Ошибка получения списка торговых пар Bitget: ' + error.message);
      throw error;
    }
  }

  /**
   * Получение списка доступных фьючерсных торговых пар
   * @param {string} productType - Тип контракта (umcbl - USDT маржинальные, dmcbl - USDC маржинальные, cmcbl - инверсные)
   * @returns {Promise<Array>} - Массив доступных фьючерсных пар
   */
  async getFuturesTradingPairs(productType = 'umcbl') {
    try {
      // Если кеш есть и содержит нужный productType — используем его
      if (
        this.marketCache.futures &&
        this.marketCache.futures.some(symbol => symbol.productType === productType)
      ) {
        const filtered = this.marketCache.futures.filter(symbol => symbol.productType === productType);
        console.log(`[Bitget] Возвращаю ${filtered.length} пар из кеша для productType=${productType}`);
        return filtered.map(symbol => ({
          symbol: symbol.symbolName,
          baseAsset: symbol.baseCoin,
          quoteAsset: symbol.quoteCoin || 'USDT',
          status: symbol.status === 'normal' ? 'TRADING' : 'NOT_TRADING',
          contractType: symbol.symbolName.includes('_PERP') ? 'PERPETUAL' : 'DELIVERY',
          minLeverage: parseInt(symbol.minLeverage),
          maxLeverage: parseInt(symbol.maxLeverage),
          priceStep: parseFloat(symbol.priceEndStep),
          marketType: 'futures',
          productType: symbol.productType
        }));
      }
      // Если нет — делаем запрос к Bitget с нужным productType
      const response = await this.publicRequest('/api/mix/v1/market/contracts', { productType });
      // Добавляем в кеш (расширяем, не теряя другие productType)
      if (this.marketCache.futures) {
        this.marketCache.futures = [
          ...this.marketCache.futures.filter(s => s.productType !== productType),
          ...response.data
        ];
      } else {
        this.marketCache.futures = response.data;
      }
      console.log(`[Bitget] Загружено ${response.data.length} фьючерсных пар с productType=${productType} и добавлено в кеш.`);
      return response.data.map(symbol => ({
        symbol: symbol.symbolName,
        baseAsset: symbol.baseCoin,
        quoteAsset: symbol.quoteCoin || 'USDT',
        status: symbol.status === 'normal' ? 'TRADING' : 'NOT_TRADING',
        contractType: symbol.symbolName.includes('_PERP') ? 'PERPETUAL' : 'DELIVERY',
        minLeverage: parseInt(symbol.minLeverage),
        maxLeverage: parseInt(symbol.maxLeverage),
        priceStep: parseFloat(symbol.priceEndStep),
        marketType: 'futures',
        productType: symbol.productType
      }));
    } catch (error) {
      console.error('Ошибка получения списка фьючерсных пар Bitget: ' + error.message);
      throw error;
    }
  }

  /**
   * Определение типа рынка и соответствующего эндпоинта по символу
   * @param {string} symbol - Символ торговой пары
   * @returns {Object} - Информация о рынке и эндпоинты
   */
  _getMarketTypeBySymbol(symbol) {
    // Проверка на undefined или null
    if (!symbol) {
      // Возвращаем значения по умолчанию, если символ не указан
      return {
        marketType: 'spot',
        endpointPrefix: '/api/spot/v1',
        wsPrefix: '/spot/v1',
        httpClient: this.httpClient
      };
    }
    
    // По умолчанию считаем, что это спот
    let marketType = 'spot';
    let endpointPrefix = '/api/spot/v1';
    let wsPrefix = '/spot/v1';
    let httpClient = this.httpClient;
    
    // Если символ содержит '_USDT' или '_PERP', то это фьючерсы
    if (symbol.includes('_USDT') || symbol.includes('_PERP') || symbol.includes('_USD')) {
      marketType = 'futures';
      endpointPrefix = '/api/mix/v1';
      wsPrefix = '/mix/v1';
      httpClient = this.futuresHttpClient;
    }
    
    return { marketType, endpointPrefix, wsPrefix, httpClient };
  }
 /**
 * Получение данных графика для указанной пары
 * @param {Object} params - Параметры запроса
 * @returns {Promise<Array>} - Массив свечей в стандартном формате
 */
async getChartData(params) {
  try {
    // Обработка параметров
    const symbol = params.symbol;
    const interval = params.interval || '1h';
    const limit = params.limit || 100;
    const endTime = params.endTime;
    const marketType = params.marketType || 'futures';
    
    // Проверяем параметры
    if (!symbol) {
      throw new Error('Символ пары не указан');
    }
    
    console.log(`Запрос данных графика для ${symbol}, интервал: ${interval}, лимит: ${limit}, тип рынка: ${marketType}`);
    
    // Преобразуем интервал из формата Binance в формат Bitget для фьючерсов
    const intervalMapFutures = {
      '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1H', '4h': '4H', '6h': '6H', '12h': '12H', 
      '1d': '1D', '1w': '1W', '1M': '1M'
    };
    
    // Преобразуем интервал из формата Binance в формат Bitget для спота
    const intervalMapSpot = {
      '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
      '1h': '60min', '4h': '4hour', '1d': '1day', '1w': '1week'
    };
    
    // Определяем эндпоинт и параметры в зависимости от типа рынка
    let endpoint, requestParams;
    
    if (marketType === 'futures') {
      // Для фьючерсов
      endpoint = '/api/mix/v1/market/history-candles';
      
      // Преобразуем символ в формат, понятный Bitget API для фьючерсов
      let apiSymbol = symbol;
      if (!symbol.includes('_UMCBL')) {
        apiSymbol = symbol + '_UMCBL';
      }
      
      const bitgetInterval = intervalMapFutures[interval] || '1H';
      
      // Текущее время в миллисекундах
      const now = Date.now();
      
      // Начальное и конечное время для запроса
      let startTime, endTimeMs;
      
      if (endTime) {
        // Если указано конечное время, используем его (преобразуем в миллисекунды, если оно в секундах)
        endTimeMs = endTime < 10000000000 ? endTime * 1000 : endTime;
      } else {
        // Если конечное время не указано, используем текущее время
        endTimeMs = now;
      }
      
      // Вычисляем стартовое время на основе лимита и интервала
      // Временной диапазон = интервал в миллисекундах * количество свечей
      startTime = endTimeMs - (this._getIntervalMs(interval) * limit);
      
      requestParams = {
        symbol: apiSymbol,
        granularity: bitgetInterval,
        startTime: startTime.toString(),
        endTime: endTimeMs.toString()
      };
      
      // Если API поддерживает параметр limit, добавляем его
      if (limit) {
        requestParams.limit = limit;
      }
    } else {
      // ... код для спота (не меняем)
    }
    
    console.log('Запрос к Bitget API с параметрами:', requestParams);
    
    // Выполняем запрос
    const response = await this.publicRequest(endpoint, requestParams);
    
    // ВАЖНОЕ ИЗМЕНЕНИЕ: проверяем ответ по-другому
    // Проверяем, что response - это массив
    if (!Array.isArray(response)) {
      console.log('Получен ответ типа:', typeof response);
      throw new Error(`Неожиданный формат ответа от API: ${JSON.stringify(response)}`);
    }
    
    console.log('Получен ответ типа:', typeof response);
    console.log('Ответ является массивом:', Array.isArray(response));
    console.log('Количество элементов в массиве:', response.length);
    
    if (response.length === 0) {
      console.log('Получен пустой массив данных от API биржи');
      return [];
    }
    
    // Преобразуем данные в стандартный формат
    // Формат ответа Bitget для history-candles: [timestamp, open, high, low, close, volume, turnover]
    const candles = response.map(candle => {
      // Проверяем, что candle - это массив с достаточным количеством элементов
      if (!Array.isArray(candle) || candle.length < 6) {
        console.warn('Некорректный формат свечи:', candle);
        return null;
      }
      
      // Пробуем parse значения. Если неудачно - логируем ошибку
      try {
        // Время уже в миллисекундах для history-candles
        const timestamp = parseInt(candle[0]);
          
        return {
          openTime: timestamp,
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          closeTime: timestamp + this._getIntervalMs(interval) - 1
        };
      } catch (parseError) {
        console.error('Ошибка при парсинге свечи:', parseError, candle);
        return null;
      }
    }).filter(candle => candle !== null); // Отфильтровываем неудачно обработанные свечи
    
    return candles;
  } catch (error) {
    console.error(`Ошибка при запросе данных графика: ${error.message}`);
    // Возвращаем пустой массив
    return [];
  }
}

  /**
   * Получение тикера (текущей цены) для символа
   * @param {string} symbol - Символ торговой пары
   * @param {string} marketType - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Object>} - Информация о тикере
   */
  async getTicker(symbol, marketType) {
    try {
      // Проверка, что символ передан
      if (!symbol) {
        throw new Error('Символ торговой пары не указан');
      }

      // Если marketType не указан, определяем его по символу
      if (!marketType) {
        marketType = this._getMarketTypeBySymbol(symbol).marketType;
      }
      
      // Выбираем эндпоинт в зависимости от типа рынка
      const endpoint = marketType === 'futures'
        ? '/api/mix/v1/market/ticker'
        : '/api/spot/v1/market/ticker';
      
      // Выполняем запрос
      const response = await this.publicRequest(endpoint, { symbol });
      
      // Преобразуем в стандартный формат
      const ticker = response.data;
      
      return {
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.last || ticker.close || 0),
        bidPrice: parseFloat(ticker.bestBid || ticker.bid || 0),
        askPrice: parseFloat(ticker.bestAsk || ticker.ask || 0),
        volume24h: parseFloat(ticker.volume24h || ticker.baseVolume || 0),
        high24h: parseFloat(ticker.high24h || ticker.high || 0),
        low24h: parseFloat(ticker.low24h || ticker.low || 0),
        timestamp: ticker.timestamp || Date.now()
      };
    } catch (error) {
      console.error('Ошибка получения тикера для пары ' + symbol + ': ' + error.message);
      throw error;
    }
  }

  /**
   * Получение глубины рынка (стакана)
   * @param {string} symbol - Символ торговой пары
   * @param {number} limit - Глубина стакана (количество уровней)
   * @param {string} marketType - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Object>} - Данные стакана
   */
  async getOrderBook(symbol, limit = 20, marketType) {
    try {
      // Если marketType не указан, определяем его по символу
      if (!marketType) {
        marketType = this._getMarketTypeBySymbol(symbol).marketType;
      }
      
      // Выбираем эндпоинт в зависимости от типа рынка
      const endpoint = marketType === 'futures'
        ? '/api/mix/v1/market/depth'
        : '/api/spot/v1/market/depth';
      
      // Выполняем запрос
      const response = await this.publicRequest(endpoint, { 
        symbol, 
        limit: Math.min(limit, 50) // Максимум 50 уровней для Bitget
      });
      
      // Преобразуем в стандартный формат
      const orderbook = response.data;
      
      return {
        lastUpdateId: orderbook.ts || Date.now(),
        symbol,
        bids: orderbook.bids.map(item => [parseFloat(item[0]), parseFloat(item[1])]),
        asks: orderbook.asks.map(item => [parseFloat(item[0]), parseFloat(item[1])])
      };
    } catch (error) {
      console.error('Ошибка получения стакана для пары ' + symbol + ': ' + error.message);
      throw error;
    }
  }

  /**
   * Создание ордера
   * @param {Object} orderParams - Параметры ордера
   * @returns {Promise<Object>} - Информация о созданном ордере
   */
  async createOrder(orderParams) {
    try {
      const { symbol, side, type, quantity, price, marketType = 'spot' } = orderParams;
      
      // Проверяем обязательные параметры
      if (!symbol || !side || !type || !quantity) {
        throw new Error('Не указаны обязательные параметры (symbol, side, type, quantity)');
      }
      
      // Проверяем, что для limit ордера указана цена
      if (type.toLowerCase() === 'limit' && !price) {
        throw new Error('Для limit ордера необходимо указать цену');
      }
      
      // Формируем данные для запроса в зависимости от типа рынка
      let endpoint, requestData;
      
      if (marketType === 'futures') {
        endpoint = '/api/mix/v1/order/placeOrder';
        
        requestData = {
          symbol,
          marginCoin: symbol.split('_')[1] || 'USDT',
          size: quantity.toString(),
          side: side.toUpperCase(),
          orderType: type.toUpperCase()
        };
        
        if (type.toLowerCase() === 'limit') {
          requestData.price = price.toString();
        }
      } else {
        endpoint = '/api/spot/v1/trade/orders';
        
        requestData = {
          symbol,
          side: side.toLowerCase(),
          orderType: type.toLowerCase(),
          quantity: quantity.toString()
        };
        
        if (type.toLowerCase() === 'limit') {
          requestData.price = price.toString();
        }
      }
      
      // Выполняем запрос
      const response = await this.privateRequest('POST', endpoint, requestData);
      
      // Преобразуем в стандартный формат
      return {
        orderId: response.data.orderId,
        symbol,
        side,
        type,
        price,
        quantity,
        status: 'NEW',
        createTime: Date.now(),
        marketType
      };
    } catch (error) {
      console.error('Ошибка создания ордера: ' + error.message);
      throw error;
    }
  }

  /**
   * Отмена ордера
   * @param {string} symbol - Символ торговой пары
   * @param {string} orderId - ID ордера
   * @param {string} marketType - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Object>} - Результат отмены ордера
   */
  async cancelOrder(symbol, orderId, marketType) {
    try {
      // Если marketType не указан, определяем его по символу
      if (!marketType) {
        marketType = this._getMarketTypeBySymbol(symbol).marketType;
      }
      
      // Формируем данные для запроса в зависимости от типа рынка
      let endpoint, requestData;
      
      if (marketType === 'futures') {
        endpoint = '/api/mix/v1/order/cancel-order';
        
        requestData = {
          symbol,
          orderId
        };
      } else {
        endpoint = '/api/spot/v1/trade/cancel-order';
        
        requestData = {
          symbol,
          orderId
        };
      }
      
      // Выполняем запрос
      await this.privateRequest('POST', endpoint, requestData);
      
      // Преобразуем в стандартный формат
      return {
        orderId,
        symbol,
        status: 'CANCELED',
        time: Date.now()
      };
    } catch (error) {
      console.error('Ошибка отмены ордера ' + orderId + ': ' + error.message);
      throw error;
    }
  }

  /**
   * Получение открытых ордеров
   * @param {string} symbol - Символ торговой пары (опционально)
   * @param {string} marketType - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Array>} - Список открытых ордеров
   */
  async getOpenOrders(symbol, marketType) {
    try {
      // Если есть символ, но нет явного marketType, определяем его по символу
      if (symbol && !marketType) {
        marketType = this._getMarketTypeBySymbol(symbol).marketType;
      }
      
      let endpoint, params = {};
      
      // Если marketType не указан явно, сначала получаем спотовые ордера
      if (!marketType || marketType === 'spot') {
        endpoint = '/api/spot/v1/trade/open-orders';
        
        if (symbol) {
          params.symbol = symbol;
        }
        
        const spotResponse = await this.privateRequest('GET', endpoint, null, params);
        
        // Преобразуем спотовые ордера в стандартный формат
        const spotOrders = spotResponse.data.map(order => {
          return {
            orderId: order.orderId,
            symbol: order.symbol,
            price: parseFloat(order.price),
            quantity: parseFloat(order.quantity),
            executedQty: parseFloat(order.filledQuantity || 0),
            side: order.side.toUpperCase(),
            type: order.orderType.toUpperCase(),
            status: order.status.toUpperCase(),
            time: order.cTime,
            marketType: 'spot'
          };
        });
        
        // Если marketType явно указан как spot, возвращаем только спотовые ордера
        if (marketType === 'spot') {
          return spotOrders;
        }
        
        // Иначе, получаем также и фьючерсные ордера
        try {
          endpoint = '/api/mix/v1/order/current';
          params = {};
          
          if (symbol) {
            params.symbol = symbol;
          }
          
          const futuresResponse = await this.privateRequest('GET', endpoint, null, params);
          
          // Преобразуем фьючерсные ордера в стандартный формат
          const futuresOrders = futuresResponse.data.map(order => {
            return {
              orderId: order.orderId,
              symbol: order.symbol,
              price: parseFloat(order.price),
              quantity: parseFloat(order.size),
              executedQty: parseFloat(order.filledQty || 0),
              side: order.side.toUpperCase(),
              type: order.orderType.toUpperCase(),
              status: order.status.toUpperCase(),
              time: order.cTime,
              marketType: 'futures'
            };
          });
          
          // Объединяем спотовые и фьючерсные ордера
          return spotOrders.concat(futuresOrders);
        } catch (error) {
          console.warn('Ошибка получения фьючерсных ордеров: ' + error.message);
          return spotOrders;
        }
      } else if (marketType === 'futures') {
        // Если marketType явно указан как futures
        endpoint = '/api/mix/v1/order/current';
        
        if (symbol) {
          params.symbol = symbol;
        }
        
        const futuresResponse = await this.privateRequest('GET', endpoint, null, params);
        
        // Преобразуем фьючерсные ордера в стандартный формат
        return futuresResponse.data.map(order => {
          return {
            orderId: order.orderId,
            symbol: order.symbol,
            price: parseFloat(order.price),
            quantity: parseFloat(order.size),
            executedQty: parseFloat(order.filledQty || 0),
            side: order.side.toUpperCase(),
            type: order.orderType.toUpperCase(),
            status: order.status.toUpperCase(),
            time: order.cTime,
            marketType: 'futures'
          };
        });
      }
      
      return []; // Если не удалось определить тип рынка
    } catch (error) {
      console.error('Ошибка получения открытых ордеров: ' + error.message);
      throw error;
    }
  }

  /**
   * Получение балансов аккаунта
   * @param {string} marketType - Тип рынка ('spot', 'futures')
   * @returns {Promise<Array>} - Список балансов
   */
  async getAccountBalance(marketType = 'spot') {
    try {
      let endpoint;
      
      if (marketType === 'futures') {
        endpoint = '/api/mix/v1/account/accounts';
        
        const response = await this.privateRequest('GET', endpoint);
        
        // Преобразуем в стандартный формат для фьючерсов
        return response.data.map(asset => {
          return {
            asset: asset.marginCoin,
            free: parseFloat(asset.available),
            locked: parseFloat(asset.locked || 0),
            total: parseFloat(asset.equity),
            unrealizedProfit: parseFloat(asset.unrealizedPL || 0),
            marketType: 'futures'
          };
        });
      } else {
        endpoint = '/api/spot/v1/account/assets';
        
        const response = await this.privateRequest('GET', endpoint);
        
        // Преобразуем в стандартный формат для спота
        return response.data.map(asset => {
          return {
            asset: asset.coinName,
            free: parseFloat(asset.available),
            locked: parseFloat(asset.frozen || 0),
            total: parseFloat(asset.available) + parseFloat(asset.frozen || 0),
            marketType: 'spot'
          };
        });
      }
    } catch (error) {
      console.error('Ошибка получения балансов аккаунта: ' + error.message);
      throw error;
    }
  }

  /**
   * Получение длительности интервала в миллисекундах
   * @param {string} interval - Интервал (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
   * @returns {number} - Длительность в миллисекундах
   */
  _getIntervalMs(interval) {
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
    
    return intervalMap[interval] || 60 * 60 * 1000; // По умолчанию 1h
  }

  /**
   * Получение длительности интервала в секундах
   * @param {string} interval - Интервал (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
   * @returns {number} - Длительность в секундах
   */
  _getIntervalSeconds(interval) {
    return this._getIntervalMs(interval) / 1000;
  }

  /**
   * Подписка на поток кандлстиков через WebSocket
   * @param {string} symbol - Символ торговой пары
   * @param {string} interval - Интервал (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
   * @param {Function} callback - Функция обратного вызова
   * @returns {string} - Имя потока для отписки
   */
  subscribeToKlineStream(symbol, interval, callback) {
    try {
      // Получаем информацию о типе рынка
      const { marketType } = this._getMarketTypeBySymbol(symbol);
      
      // Преобразуем интервал в формат Bitget
      const intervalMap = {
        '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
        '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W'
      };
      
      const bitgetInterval = intervalMap[interval] || '1H';
      
      // Формируем идентификатор канала и потока
      const channelType = 'candle' + bitgetInterval;
      const streamName = `ws_${marketType}_${channelType}_${symbol}`;
      
      // Создаем WebSocket соединение
      const ws = new WebSocket(this.wsBaseUrl);
      
      // Сохраняем ссылку на this для использования в обработчиках
      const self = this;
      
      // Обработка открытия соединения
      ws.onopen = function() {
        console.log('WebSocket соединение установлено для ' + streamName);
        
        // Отправляем запрос на подписку
        const subscribeMsg = JSON.stringify({
          op: 'subscribe',
          args: [{
            instType: marketType === 'futures' ? 'mc' : 'sp',
            channel: channelType,
            instId: symbol
          }]
        });
        
        ws.send(subscribeMsg);
        
        // Если требуется авторизация для приватных потоков
        if (self.isAuthorized) {
          const timestamp = Date.now().toString();
          const signature = self.generateSignature(timestamp, 'GET', '/user/verify', '');
          
          const loginMsg = JSON.stringify({
            op: 'login',
            args: [{
              apiKey: self.apiKey,
              passphrase: self.passphrase,
              timestamp,
              sign: signature
            }]
          });
          
          ws.send(loginMsg);
        }
      };
      
      // Обработка сообщений
      ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          // Игнорируем служебные сообщения о подписке или пинг
          if (data.event === 'subscribe' || data.op === 'pong') {
            return;
          }
          
          // Проверяем, содержит ли сообщение данные свечей
          if (data.data && data.arg && data.arg.channel && data.arg.channel.startsWith('candle')) {
            // Преобразуем данные в стандартный формат
            const candles = data.data;
            
            if (Array.isArray(candles) && candles.length > 0) {
              // Формат свечи может быть разным в зависимости от реализации
              const standardizedCandle = self._formatCandle(candles[0], interval);
              
              // Вызываем callback с данными свечи
              callback(standardizedCandle);
            }
          }
        } catch (error) {
          console.error('Ошибка обработки сообщения WebSocket: ' + error.message);
        }
      };
      
      // Пинг для поддержания соединения (каждые 20 секунд)
      const pingInterval = setInterval(function() {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
        }
      }, 20000);
      
      // Обработка ошибок
      ws.onerror = function(error) {
        console.error('WebSocket ошибка для ' + streamName + ':', error);
        clearInterval(pingInterval);
      };
      
      // Обработка закрытия соединения
      ws.onclose = function() {
        console.log('WebSocket соединение закрыто для ' + streamName);
        clearInterval(pingInterval);
        delete self.wsConnections[streamName];
      };
      
      // Сохраняем соединение и интервал для возможности отписки
      this.wsConnections[streamName] = {
        ws,
        pingInterval
      };
      
      return streamName;
    } catch (error) {
      console.error('Ошибка подписки на поток кандлстиков: ' + error.message);
      return null;
    }
  }
  
  /**
   * Форматирование свечи в стандартный формат
   * @param {Array|Object} candle - Данные свечи
   * @param {string} interval - Интервал свечи
   * @returns {Object} - Стандартизированные данные свечи
   */
  _formatCandle(candle, interval) {
    // Если свеча представлена в виде массива [time, open, high, low, close, volume, ...]
    if (Array.isArray(candle)) {
      return {
        openTime: parseInt(candle[0]) * 1000, // Преобразуем из секунд в миллисекунды
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[0]) * 1000 + this._getIntervalMs(interval) - 1
      };
    } 
    // Если свеча представлена в виде объекта
    else {
      return {
        openTime: parseInt(candle.ts || candle.timestamp) * 1000,
        open: parseFloat(candle.o || candle.open),
        high: parseFloat(candle.h || candle.high),
        low: parseFloat(candle.l || candle.low),
        close: parseFloat(candle.c || candle.close),
        volume: parseFloat(candle.v || candle.vol || candle.volume),
        closeTime: parseInt(candle.ts || candle.timestamp) * 1000 + this._getIntervalMs(interval) - 1
      };
    }
  }

  /**
   * Отписка от потока WebSocket
   * @param {string} streamName - Имя потока, полученное при подписке
   * @returns {boolean} - Результат отписки
   */
  unsubscribeFromStream(streamName) {
    try {
      if (this.wsConnections[streamName]) {
        // Получаем соединение и интервал
        const ws = this.wsConnections[streamName].ws;
        const pingInterval = this.wsConnections[streamName].pingInterval;
        
        // Останавливаем пинг-интервал
        if (pingInterval) {
          clearInterval(pingInterval);
        }
        
        // Если соединение открыто, отправляем запрос на отписку
        if (ws.readyState === WebSocket.OPEN) {
          // Парсим streamName для получения параметров
          // Формат: ws_spot_candle1H_BTCUSDT или ws_futures_candle1H_BTCUSDT_UMCBL
          const parts = streamName.split('_');
          if (parts.length >= 4) {
            const marketType = parts[1]; // spot или futures
            const channelType = parts[2]; // candle1H
            const symbol = parts.slice(3).join('_'); // BTCUSDT или BTCUSDT_UMCBL
            
            // Отправляем запрос на отписку
            const unsubscribeMsg = {
              op: 'unsubscribe',
              args: [{
                instType: marketType === 'futures' ? 'mc' : 'sp',
                channel: channelType,
                instId: symbol
              }]
            };
            
            ws.send(JSON.stringify(unsubscribeMsg));
          }
        }
        
        // Закрываем соединение
        ws.close();
        
        // Удаляем из списка соединений
        delete this.wsConnections[streamName];
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Ошибка отписки от потока ' + streamName + ': ' + error.message);
      return false;
    }
  }

  /**
   * Очистка ресурсов при завершении работы
   */
  cleanup() {
    // Закрываем все WebSocket соединения
    Object.keys(this.wsConnections).forEach(streamName => {
      try {
        const connection = this.wsConnections[streamName];
        const ws = connection.ws;
        const pingInterval = connection.pingInterval;
        
        // Останавливаем пинг-интервал
        if (pingInterval) {
          clearInterval(pingInterval);
        }
        
        // Закрываем WebSocket соединение
        if (ws && ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
      } catch (error) {
        console.error('Ошибка при закрытии WebSocket соединения ' + streamName + ': ' + error.message);
      }
    });
    
    this.wsConnections = {};
    this.isInitialized = false;
    console.log('Коннектор Bitget выгружен');
  }
}

module.exports = BitgetConnector;