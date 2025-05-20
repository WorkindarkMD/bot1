// apiService.js - Оптимизированный сервис для работы с API
import { API_BASE_URL, API_PATHS, DEFAULT_REQUEST_CONFIG, buildUrl } from './apiConfig';

/**
 * Основной класс для работы с API
 */
class ApiService {
  /**
   * Максимальное количество повторных попыток для запросов
   */
  maxRetries = 3;

  constructor() {
    // Отслеживаем неудачные эндпоинты, чтобы не делать повторные запросы
    this.failedEndpoints = new Set();

    // Очередь запросов и обработка
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentRequests = 5;
    this.activeRequests = 0;
    
    // Время последней ошибки и время паузы для запросов
    this.lastErrorTime = 0;
    this.pauseRequestsUntil = 0;
    
    // Маппинг для демо-данных различных типов запросов
    this.demoDataGenerators = {
      'chart': this._generateDemoCandles.bind(this),
      'positions': () => [],
      'orders': () => []
    };
    
    // Кэширование ответов для снижения количества запросов
    this.responseCache = new Map();
    
    // Настройки TTL кэширования для разных типов запросов
    this.cacheTTL = {
      default: 30000, // 30 секунд по умолчанию
      status: 60000, // 1 минута для статуса
      settings: 300000, // 5 минут для настроек
      exchanges: 600000, // 10 минут для бирж
      pairs: 300000, // 5 минут для пар
      chart: 10000, // 10 секунд для графика - самые частые обновления
      indicators: 60000 // 1 минута для индикаторов
    };
    
    // Счетчик запросов для отладки
    this.requestCounter = 0;
    
    // Запросы в процессе выполнения
    this.requestsInProgress = {};
    
    // Запускаем обработчик очереди
    this.processQueue();
    
    // DEBUG: Для отладки кэшированных данных
    this.enableDebugLogs = false;
  }

  /**
   * Обработка очереди запросов
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0 || this.activeRequests >= this.maxConcurrentRequests) {
      setTimeout(() => this.processQueue(), 200);
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
        // Проверка режима глобальной паузы
        if (window._pauseAllRequests || Date.now() < this.pauseRequestsUntil) {
          break;
        }
        
        const task = this.requestQueue.shift();
        this.activeRequests++;
        
        try {
          const result = await task.execute();
          task.resolve(result);
        } catch (error) {
          console.error(`Ошибка при выполнении запроса ${task.path}:`, error);
          task.reject(error);
        } finally {
          this.activeRequests--;
        }
      }
    } catch (error) {
      console.error('Ошибка в обработчике очереди:', error);
    } finally {
      this.isProcessingQueue = false;
      setTimeout(() => this.processQueue(), 200);
    }
  }

  /**
   * Добавление запроса в очередь
   * @param {Function} executeFunc - Функция выполнения запроса
   * @param {string} path - Путь API для логирования
   * @returns {Promise<any>} - Результат запроса
   */
  enqueueRequest(executeFunc, path) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;
      
      // Логируем начало запроса
      if (this.enableDebugLogs) {
        console.debug(`[API ${requestId}] Добавлен запрос в очередь: ${path}`);
      
        if (this.activeRequests >= this.maxConcurrentRequests) {
          console.debug(`[API ${requestId}] Достигнут лимит одновременных запросов (${this.maxConcurrentRequests}), запрос отложен`);
        }
      }
      
      this.requestQueue.push({
        execute: async () => {
          if (this.enableDebugLogs) {
            console.debug(`[API ${requestId}] Начало выполнения запроса: ${path}`);
          }
          try {
            const result = await executeFunc();
            if (this.enableDebugLogs) {
              console.debug(`[API ${requestId}] Запрос завершен успешно: ${path}`);
            }
            return result;
          } catch (error) {
            if (this.enableDebugLogs) {
              console.debug(`[API ${requestId}] Запрос завершен с ошибкой: ${path}`, error);
            }
            throw error;
          }
        },
        resolve,
        reject,
        path,
        requestId,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Функция для предотвращения дублирующих запросов с настройкой TTL кэша
   * @param {string} key - Уникальный ключ запроса
   * @param {Function} fetchFunction - Функция загрузки данных
   * @param {number} cacheTTL - Время жизни кэша в мс (по умолчанию 30 секунд)
   * @param {boolean} bypassCache - Игнорировать кэш и выполнить новый запрос
   * @returns {Promise<any>} - Результат запроса
   */
  async preventDuplicateRequests(key, fetchFunction, cacheTTL = this.cacheTTL.default, bypassCache = false) {
    // Проверяем, есть ли запрос в процессе выполнения
    if (this.requestsInProgress[key]) {
      if (this.enableDebugLogs) {
        console.log(`Запрос ${key} уже выполняется, ожидаем...`);
      }
      return this.requestsInProgress[key];
    }
    
    // Проверяем кэш, если не нужно его игнорировать
    if (!bypassCache) {
      const cachedResponse = this.responseCache.get(key);
      
      if (cachedResponse) {
        const cacheAge = Date.now() - cachedResponse.timestamp;
        
        // Если время жизни кэша не истекло
        if (cacheAge < cacheTTL) {
          if (this.enableDebugLogs) {
            console.log(`Используем кэшированный ответ для ${key} (возраст: ${Math.round(cacheAge/1000)}с)`);
          }
          return cachedResponse.data;
        } else {
          if (this.enableDebugLogs) {
            console.log(`Кэш для ${key} устарел (возраст: ${Math.round(cacheAge/1000)}с), запрашиваем новые данные`);
          }
        }
      }
    } else if (this.enableDebugLogs) {
      console.log(`Игнорируем кэш для ${key}, выполняем свежий запрос`);
    }
    
    try {
      // Регистрируем запрос как выполняющийся
      this.requestsInProgress[key] = fetchFunction();
      const result = await this.requestsInProgress[key];
      
      // Сохраняем результат в кэш
      this.responseCache.set(key, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } finally {
      // Удаляем запрос из списка выполняющихся
      delete this.requestsInProgress[key];
    }
  }

  /**
   * Определение TTL кэша для определенного типа запроса
   * @param {string} path - Путь запроса
   * @returns {number} - TTL в миллисекундах
   */
  getCacheTTLForPath(path) {
    if (path.includes('/status')) return this.cacheTTL.status;
    if (path.includes('/settings')) return this.cacheTTL.settings;
    if (path.includes('/exchanges')) return this.cacheTTL.exchanges;
    if (path.includes('/pairs')) return this.cacheTTL.pairs;
    if (path.includes('/chart')) return this.cacheTTL.chart;
    if (path.includes('/indicators')) return this.cacheTTL.indicators;
    return this.cacheTTL.default;
  }

  /**
   * Базовый метод GET с поддержкой очереди и кэширования
   * @param {string} path - Путь API
   * @param {Object} params - Параметры запроса
   * @param {Object} config - Дополнительные настройки fetch
   * @param {number} retries - Количество оставшихся повторных попыток
   * @param {boolean} silent - Не показывать индикаторы загрузки
   * @param {number} cacheTTL - Время жизни кэша в мс
   * @param {boolean} forceRefresh - Принудительное обновление данных
   * @returns {Promise<any>} - Результат запроса
   */
  get(path, params = {}, config = {}, retries = this.maxRetries, silent = false, cacheTTL = null, forceRefresh = false) {
    // Проверяем кэш
    const cacheKey = `${path}?${new URLSearchParams(params).toString()}`;
    
    // Определяем TTL для данного типа запроса, если не указан явно
    const effectiveCacheTTL = cacheTTL !== null ? cacheTTL : this.getCacheTTLForPath(path);
    
    // Проверка черного списка эндпоинтов
    const endpoint = `${path}?${new URLSearchParams(params).toString()}`;
    if (this.failedEndpoints.has(endpoint)) {
      if (this.enableDebugLogs) {
        console.debug(`Пропускаем запрос к неработающему эндпоинту: ${endpoint}`);
      }
      return Promise.resolve(this._getDemoDataForPath(path, params));
    }

    // Используем preventDuplicateRequests для эффективного кэширования
    return this.preventDuplicateRequests(
      cacheKey,
      () => this._executeGetRequest(path, params, config, retries, endpoint),
      effectiveCacheTTL,
      forceRefresh
    );
  }

  /**
   * Выполнение GET запроса (внутренний метод)
   * @private
   */
  async _executeGetRequest(path, params, config, retries, endpoint) {
    return this.enqueueRequest(async () => {
      const url = buildUrl(path, params);
      // CORS ИСПРАВЛЕНИЕ: Удаляем проблемные заголовки, вызывающие предварительные CORS-запросы
      const fetchConfig = { 
        method: 'GET',
        ...DEFAULT_REQUEST_CONFIG,
        ...config,
        // Добавляем случайный параметр в URL вместо заголовков
        headers: {
          ...DEFAULT_REQUEST_CONFIG.headers,
          ...config.headers
          // Не используем заголовки Cache-Control, которые вызывают preflight CORS-запросы
        }
      };
      
      try {
        // Добавляем timestamp к URL для избежания кэширования браузером
        const nonCachedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        
        if (this.enableDebugLogs) {
          console.debug(`GET запрос к ${nonCachedUrl}`);
        }
        
        const response = await fetch(nonCachedUrl, fetchConfig);
        
        if (!response.ok) {
          throw await this.handleError(response);
        }
        
        const data = await response.json();
        
        // Если запрос успешен, удаляем из списка неудачных (если был)
        this.failedEndpoints.delete(endpoint);
        
        return data;
      } catch (error) {
        // Улучшенная обработка сетевых ошибок
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.error(`Сетевая ошибка при запросе к ${url}. Возможные причины: сервер не запущен или проблемы с CORS`);
          
          // Добавляем в черный список эндпоинтов
          this.failedEndpoints.add(endpoint);
          
          // Устанавливаем глобальную паузу для запросов на 3 секунды
          this.lastErrorTime = Date.now();
          this.pauseRequestsUntil = this.lastErrorTime + 3000;
          
          // Возвращаем демо-данные для данного типа запроса
          return this._getDemoDataForPath(path, params);
        }
        
        // Если есть еще попытки, пробуем повторить запрос через новую задачу в очереди
        if (retries > 0) {
          if (this.enableDebugLogs) {
            console.debug(`Повторная попытка запроса (осталось ${retries}): ${url}`);
          }
          const delay = (this.maxRetries - retries + 1) * 1000; // Увеличивающаяся задержка
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.get(path, params, config, retries - 1);
        }
        
        console.error(`GET Error at ${path}:`, error);
        return this._getDemoDataForPath(path, params);
      }
    }, path);
  }
  
  /**
   * Получение демо-данных для различных типов запросов
   * @param {string} path - Путь API
   * @param {Object} params - Параметры запроса
   * @returns {Object} - Демо-данные
   * @private
   */
  _getDemoDataForPath(path, params) {
    // Определяем тип запроса на основе пути
    let type = 'unknown';
    if (path.includes('/chart')) {
      type = 'chart';
      return { 
        success: true, 
        candles: this._generateDemoCandles(params.symbol || params.pair || 'BTCUSDT', params.interval || '1h', params.limit || 100)
      };
    } else if (path.includes('/positions')) {
      type = 'positions';
      return { success: true, positions: [] };
    } else if (path.includes('/orders')) {
      type = 'orders';
      return { success: true, orders: [] };
    } else if (path.includes('/status')) {
      return { 
        success: true, 
        status: 'ok',
        core: {
          initialized: true,
          exchange: 'bitget',
          tradingPair: 'BTCUSDT',
          modules: 5,
          activeConnectors: ['bitget']
        }
      };
    } else if (path.includes('/analytics')) {
      return {
        success: true,
        dailyProfit: 125.45,
        weeklyProfit: 734.25,
        monthlyProfit: 2840.35,
        totalProfit: 15430.76,
        winRate: 68,
        openPositions: 3
      };
    } else if (path.includes('/exchanges')) {
      return {
        success: true,
        exchanges: ['binance', 'bybit', 'bitget', 'mexc']
      };
    } else if (path.includes('/pairs')) {
      return {
        success: true,
        pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LTCUSDT', 'DOGEUSDT']
      };
    }
    
    // Для неизвестных типов запросов
    return { success: true, data: [] };
  }
  
  /**
   * Базовый метод POST с поддержкой очереди
   * @param {string} path - Путь API
   * @param {Object} data - Данные для отправки
   * @param {Object} config - Дополнительные настройки fetch
   * @param {number} retries - Количество оставшихся повторных попыток
   * @returns {Promise<any>} - Результат запроса
   */
  post(path, data = {}, config = {}, retries = this.maxRetries) {
    // Проверка черного списка эндпоинтов
    const endpoint = `${path}`;
    if (this.failedEndpoints.has(endpoint)) {
      if (this.enableDebugLogs) {
        console.debug(`Пропускаем запрос к неработающему эндпоинту: ${endpoint}`);
      }
      return Promise.resolve({ success: true, data: {} });
    }

    // Помещаем запрос в очередь
    return this.enqueueRequest(async () => {
      const url = `${API_BASE_URL}${path}`;
      const fetchConfig = {
        method: 'POST',
        ...DEFAULT_REQUEST_CONFIG,
        ...config,
        body: JSON.stringify(data),
        // CORS ИСПРАВЛЕНИЕ: Удаляем проблемные заголовки
        headers: {
          ...DEFAULT_REQUEST_CONFIG.headers,
          ...config.headers
          // Не используем X-Request-Time и другие нестандартные заголовки
        }
      };
      
      try {
        // Добавляем timestamp к URL для избежания кэширования
        const nonCachedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
        
        if (this.enableDebugLogs) {
          console.debug(`POST запрос к ${nonCachedUrl}`);
        }
        const response = await fetch(nonCachedUrl, fetchConfig);
        
        if (!response.ok) {
          throw await this.handleError(response);
        }
        
        const responseData = await response.json();
        
        // Если запрос успешен, удаляем из списка неудачных (если был)
        this.failedEndpoints.delete(endpoint);
        
        // После успешного POST запроса очищаем соответствующий GET кэш
        this.clearRelatedCache(path);
        
        return responseData;
      } catch (error) {
        // Улучшенная обработка сетевых ошибок
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.error(`Сетевая ошибка при запросе к ${url}. Возможные причины: сервер не запущен или проблемы с CORS`);
          
          // Добавляем в черный список эндпоинтов
          this.failedEndpoints.add(endpoint);
          
          // Устанавливаем глобальную паузу для запросов
          this.lastErrorTime = Date.now();
          this.pauseRequestsUntil = this.lastErrorTime + 3000;
          
          return { success: true, data: {} };
        }
        
        // Если есть еще попытки, пробуем повторить запрос
        if (retries > 0) {
          if (this.enableDebugLogs) {
            console.debug(`Повторная попытка запроса (осталось ${retries}): ${url}`);
          }
          const delay = (this.maxRetries - retries + 1) * 1000; // Увеличивающаяся задержка
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.post(path, data, config, retries - 1);
        }
        
        console.error(`POST Error at ${path}:`, error);
        return { success: true, data: {} };
      }
    }, path);
  }
  
  /**
   * Очистка связанного GET кэша при успешном POST запросе
   * @param {string} postPath - Путь POST запроса
   */
  clearRelatedCache(postPath) {
    // Получаем все ключи кэша
    const cacheKeys = Array.from(this.responseCache.keys());
    
    // Определяем базовый путь для очистки (удаляем ID и другие параметры из пути)
    let basePath = postPath;
    
    // Удаляем возможный ID в конце пути (например, /api/items/123 -> /api/items)
    const idMatch = basePath.match(/^(\/api\/[\w-]+)\/[\w-]+$/);
    if (idMatch) {
      basePath = idMatch[1];
    }
    
    // Проверяем, что базовый путь имеет смысл
    if (!basePath.startsWith('/api/')) {
      return;
    }
    
    // Находим и удаляем связанные ключи кэша
    for (const key of cacheKeys) {
      if (key.startsWith(basePath) || key.includes(basePath.replace('/api/', ''))) {
        this.responseCache.delete(key);
        if (this.enableDebugLogs) {
          console.log(`Очищен связанный кэш для ${key} после POST запроса к ${postPath}`);
        }
      }
    }
  }
  
  /**
   * Обработка ошибок
   * @param {Response} response - Ответ fetch
   * @returns {Promise<e>} - Объект ошибки
   */
  async handleError(response) {
    try {
      // Логируем полную информацию о неудачном запросе
      console.error(`HTTP ошибка ${response.status}: ${response.statusText}`);
      console.error('Headers:', Object.fromEntries([...response.headers.entries()]));
      
      // Пытаемся получить JSON с деталями ошибки
      const error = await response.json();
      return new Error(error.error || `HTTP Error ${response.status}: ${response.statusText}`);
    } catch {
      return new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
  }
  
  /**
   * Очистка кэша для заданного ключа или всего кэша
   * @param {string} [cacheKey] - Ключ кэша для очистки (если не указан, очищается весь кэш)
   */
  clearCache(cacheKey = null) {
    if (cacheKey) {
      // Если указан точный ключ
      if (this.responseCache.has(cacheKey)) {
        this.responseCache.delete(cacheKey);
        if (this.enableDebugLogs) {
          console.debug(`Кэш очищен для ключа: ${cacheKey}`);
        }
      } else {
        // Если указан частичный ключ, находим и удаляем все совпадающие записи
        const keysToDelete = [];
        
        for (const key of this.responseCache.keys()) {
          if (key.includes(cacheKey)) {
            keysToDelete.push(key);
          }
        }
        
        for (const key of keysToDelete) {
          this.responseCache.delete(key);
          if (this.enableDebugLogs) {
            console.debug(`Кэш очищен для совпадающего ключа: ${key}`);
          }
        }
      }
    } else {
      this.responseCache.clear();
      if (this.enableDebugLogs) {
        console.debug('Весь кэш очищен');
      }
    }
  }
  
  /**
   * Проверка соединения с сервером
   * @returns {Promise<boolean>} - Состояние соединения
   */
  async checkConnection() {
    try {
      // Для проверки соединения используем простой запрос без доп. заголовков
      const result = await this.get(API_PATHS.STATUS);
      return result && result.success;
    } catch (error) {
      return false;
    }
  }
  
  // ====== ОСНОВНЫЕ API МЕТОДЫ ======
  
  /**
   * Получение статуса системы
   * @returns {Promise<any>} - Статус системы
   */
  getSystemStatus() {
    return this.get(API_PATHS.STATUS);
  }
  
  /**
   * Получение настроек системы
   * @returns {Promise<any>} - Настройки системы
   */
  getSettings() {
    return this.get(API_PATHS.SETTINGS);
  }
  
  /**
   * Сохранение настроек системы
   * @param {Object} settings - Новые настройки
   * @returns {Promise<any>} - Результат сохранения
   */
  saveSettings(settings) {
    // Очищаем кэш настроек перед сохранением
    this.clearCache('settings');
    return this.post(API_PATHS.SETTINGS, settings);
  }
  
  /**
   * Получение списка поддерживаемых бирж
   * @returns {Promise<any>} - Список бирж
   */
  getExchanges() {
    return this.get(API_PATHS.EXCHANGES);
  }
  
  /**
   * Получение списка торговых пар
   * @param {string} exchange - Название биржи
   * @param {string} type - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Array>} - Список торговых пар
   */
  getPairs(exchange, type) {
    return this.get(API_PATHS.PAIRS, { exchange, type })
      .then(response => {
        // Handle the specific format {success: true, data: Array}
        if (response && response.success === true && Array.isArray(response.data)) {
          return response.data;
        }
        // Handle format {pairs: Array}
        else if (response && response.pairs && Array.isArray(response.pairs)) {
          return response.pairs;
        } 
        // Handle direct array response
        else if (response && Array.isArray(response)) {
          return response;
        } 
        else {
          console.warn('Неожиданный формат данных от API_PATHS.PAIRS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getPairs:', error);
        return [];
      });
  }
  
 /**
 * Получение данных для графика
 * @param {Object} params - Параметры запроса
 * @param {boolean} [forceRefresh=false] - Принудительное обновление данных
 * @returns {Promise<any>} - Данные для графика
 */
getChartData(params, forceRefresh = false) {
  // Добавляем обработку отсутствующих параметров
  const requestParams = {
    pair: params.symbol || params.pair || 'BTCUSDT',
    interval: params.interval || '1H',
    limit: params.limit || 100,
    // Добавляем timestamp для избежания кэширования
    _t: Date.now()
  };
  
  console.log(`Запрос к API_PATHS.CHART с параметрами:`, requestParams);
  
  return this.get(API_PATHS.CHART, requestParams, {}, 3, false, this.cacheTTL.chart, forceRefresh)
    .then(response => {
      console.log('Ответ от API графика:', response);
      
      // Проверяем все возможные форматы ответа
      
      // Формат 1: Если candles прямо в ответе
      if (response && response.candles && Array.isArray(response.candles)) {
        // Проверяем, не пустой ли массив
        if (response.candles.length > 0) {
          return response.candles;
        }
      }
      
      // Формат 2: Если chartData в ответе
      if (response && response.chartData && Array.isArray(response.chartData) && response.chartData.length > 0) {
        return response.chartData;
      }
      
      // Формат 3: Если data в ответе содержит candles
      if (response && response.data && response.data.candles && Array.isArray(response.data.candles) && response.data.candles.length > 0) {
        return response.data.candles;
      }
      
      // Формат 4: Если data в ответе и это массив
      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
      
      // Формат 5: Если ответ сам по себе массив
      if (response && Array.isArray(response) && response.length > 0) {
        return response;
      }
      
      // Если ни один из форматов не подошел, генерируем демо-данные
      console.warn('Ответ содержит пустой массив свечей или неизвестный формат:', response);
      return this._generateDemoCandles(requestParams.pair, requestParams.interval, requestParams.limit);
    })
    .catch(error => {
      console.error('Ошибка при получении данных графика:', error);
      // В случае ошибки возвращаем заглушку
      return this._generateDemoCandles(requestParams.pair, requestParams.interval, requestParams.limit);
    });
}
  /**
   * Получение текущей биржи из кеша или настроек
   * @returns {string} - Название биржи
   */
  getCurrentExchange() {
    // Попытка получить из кэша
    const statusCache = this.responseCache.get('systemStatus');
    if (statusCache && statusCache.data && statusCache.data.core) {
      return statusCache.data.core.exchange;
    }
    
    // По умолчанию
    return 'bitget';
  }

  /**
   * Получение данных графика от BitGet API
   * @param {Object} params - Параметры запроса
   * @returns {Promise<any>} - Данные для графика
   */
  getBitgetChartData(params) {
    const requestParams = {
      symbol: params.symbol || 'BTCUSDT',
      granularity: this.convertIntervalToBitget(params.interval || '1h'),
      limit: params.limit || 100,
      // Добавляем timestamp для избежания кэширования
      _t: Date.now()
    };
    
    console.log('Запрос к BitGet API с параметрами:', requestParams);
    
    return this.get(API_PATHS.CHART, requestParams, {}, 3, false, 0, true) // Без кэширования
      .then(response => {
        console.log('Получен ответ от BitGet API:', response);
        
        // Формат BitGet: { message, code, requestTime, data: [[ts, o, c, h, l, vol], [...]]}
        if (response && Array.isArray(response.data)) {
          return { 
            candles: this.normalizeCandles(response.data, requestParams.symbol, params.interval),
            source: 'bitget'
          };
        }
        
        console.warn('Неожиданный формат данных от BitGet API:', response);
        return { 
          candles: this._generateDemoCandles(requestParams.symbol, params.interval, requestParams.limit),
          error: 'Неожиданный формат ответа от BitGet API'
        };
      })
      .catch(error => {
        console.error('Ошибка при получении данных от BitGet API:', error);
        return { 
          candles: this._generateDemoCandles(requestParams.symbol, params.interval, requestParams.limit),
          error: error.message || 'Ошибка получения данных от BitGet API' 
        };
      });
  }

  /**
   * Конвертирует стандартный интервал в формат BitGet
   * @param {string} interval - Стандартный интервал (1m, 5m, 1h и т.д.)
   * @returns {string} - Интервал в формате BitGet
   */
  convertIntervalToBitget(interval) {
    const map = {
      '1m': '60',
      '5m': '300',
      '15m': '900',
      '30m': '1800',
      '1h': '3600',
      '4h': '14400',
      '1d': '86400',
      '1w': '604800'
    };
    return map[interval] || '3600'; // по умолчанию 1h
  }

  /**
   * Нормализация данных свечей из разных форматов API
   * @param {Array} candles - Исходные данные свечей
   * @param {string} symbol - Символ торговой пары
   * @param {string} interval - Интервал
   * @returns {Array} - Нормализованные данные свечей
   */
  normalizeCandles(candles, symbol, interval) {
    if (!Array.isArray(candles) || candles.length === 0) {
      return [];
    }
    
    // Выводим первую свечу для анализа формата
    console.log('Анализ формата свечей:', candles[0]);
    
    // Определим интервал в миллисекундах
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
    
    return candles.map(candle => {
      // Если свеча уже в нужном формате, возвращаем как есть
      if (candle.open !== undefined && candle.high !== undefined && 
          candle.low !== undefined && candle.close !== undefined) {
        
        // Убедимся, что есть время открытия
        if (candle.openTime === undefined && candle.time !== undefined) {
          candle.openTime = candle.time;
        }
        else if (candle.openTime === undefined && candle.timestamp !== undefined) {
          candle.openTime = candle.timestamp;
        }
        else if (candle.openTime === undefined && candle.date !== undefined) {
          candle.openTime = new Date(candle.date).getTime();
        }
        
        return candle;
      }
      
      // Для массива [timestamp, open, high, low, close, volume]
      if (Array.isArray(candle) && candle.length >= 6) {
        return {
          openTime: parseInt(candle[0]),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          closeTime: parseInt(candle[0]) + intervalMs
        };
      }
      
      // Для BitGet API [timestamp(строка), open, close, high, low, vol]
      if (Array.isArray(candle) && candle.length >= 5) {
        // Определим порядок полей на основе значений
        let open, high, low, close, timestamp, volume;
        
        if (typeof candle[0] === 'string') {
          // Формат BitGet API
          timestamp = parseInt(candle[0]);
          open = parseFloat(candle[1]);
          close = parseFloat(candle[2]);
          high = parseFloat(candle[3]);
          low = parseFloat(candle[4]);
          volume = parseFloat(candle[5] || 0);
        } else {
          // Другие форматы массивов
          timestamp = candle[0];
          open = parseFloat(candle[1]);
          high = parseFloat(candle[2]);
          low = parseFloat(candle[3]);
          close = parseFloat(candle[4]);
          volume = parseFloat(candle[5] || 0);
        }
        
        return {
          openTime: timestamp,
          open,
          high,
          low,
          close,
          volume,
          closeTime: timestamp + intervalMs
        };
      }
      
      // В случае нераспознанного формата создаем фиктивную свечу
      console.warn('Нераспознанный формат свечи:', candle);
      const timestamp = new Date().getTime() - Math.random() * 1000000;
      const basePrice = symbol.includes('BTC') ? 45000 : 2800;
      const price = basePrice + Math.random() * 1000;
      
      return {
        openTime: timestamp,
        open: price,
        high: price * 1.005,
        low: price * 0.995,
        close: price * (1 + (Math.random() - 0.5) * 0.01),
        volume: Math.random() * 10,
        closeTime: timestamp + intervalMs
      };
    });
  }

  // Метод для генерации демо-свечей
  _generateDemoCandles(symbol, timeframe, count) {
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
    
    const intervalMs = intervalMap[timeframe] || intervalMap['1h'];
    
    for (let i = count - 1; i >= 0; i--) {
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
   * Получение активных ордеров
   * @param {string} pair - Торговая пара
   * @returns {Promise<any>} - Список ордеров
   */
  getOrders(pair) {
    return this.get(API_PATHS.ORDERS, { pair, _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.orders)) {
          return response.orders;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.ORDERS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getOrders:', error);
        return [];
      });
  }

  /**
   * Получение истории позиций
   * @param {Object} params - Параметры запроса
   * @returns {Promise<any>} - История позиций
   */
  getPositionsHistory(params) {
    // Добавляем timestamp чтобы избежать кэширования
    const requestParams = { ...params, _t: Date.now() };
    
    return this.get(API_PATHS.POSITIONS_HISTORY, requestParams)
      .then(response => {
        if (response && Array.isArray(response.positions)) {
          return response.positions;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.POSITIONS_HISTORY:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getPositionsHistory:', error);
        return [];
      });
  }

  /**
   * Закрытие позиции
   * @param {string} id - ID позиции
   * @returns {Promise<any>} - Результат операции
   */
  closePosition(id) {
    // Очищаем кэш позиций при закрытии
    this.clearCache('positions');
    return this.post(API_PATHS.CLOSE_POSITION, { id });
  }

  /**
   * Исполнение торгового сигнала
   * @param {Object} signal - Торговый сигнал
   * @returns {Promise<any>} - Результат исполнения
   */
  executeSignal(signal) {
    // Очищаем кэш позиций при исполнении сигнала
    this.clearCache('positions');
    return this.post(API_PATHS.EXECUTE_SIGNAL, signal);
  }

  /**
   * Получение списка трейдеров
   * @param {string} exchange - Название биржи
   * @returns {Promise<any>} - Список трейдеров
   */
  getTraders(exchange) {
    return this.get(API_PATHS.COPY_TRADING_TRADERS, { exchange, _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.traders)) {
          return response.traders;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.COPY_TRADING_TRADERS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getTraders:', error);
        return [];
      });
  }

  /**
   * Запуск мониторинга копитрейдинга
   * @param {Object} params - Параметры мониторинга
   * @returns {Promise<any>} - Результат запуска
   */
  startCopyTrading(params) {
    // Очищаем кэш копитрейдинга
    this.clearCache('copyTradingMonitors');
    return this.post(API_PATHS.COPY_TRADING_START_MONITORING, params);
  }

  /**
   * Остановка мониторинга копитрейдинга
   * @param {string} monitorId - ID монитора
   * @returns {Promise<any>} - Результат остановки
   */
  stopCopyTrading(monitorId) {
    // Очищаем кэш копитрейдинга
    this.clearCache('copyTradingMonitors');
    return this.post(API_PATHS.COPY_TRADING_STOP_MONITORING, { monitorId });
  }

  /**
   * Получение списка активных мониторов копитрейдинга
   * @returns {Promise<any>} - Список мониторов
   */
  getCopyTradingMonitors() {
    return this.get(API_PATHS.COPY_TRADING_MONITORS, { _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.monitors)) {
          return response.monitors;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.COPY_TRADING_MONITORS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getCopyTradingMonitors:', error);
        return [];
      });
  }

  /**
   * Дополнение сигнала уровнями TP/SL
   * @param {Object} signal - Сигнал
   * @returns {Promise<any>} - Улучшенный сигнал
   */
  enhanceSignal(signal) {
    return this.post(API_PATHS.COPY_TRADING_AI_ENHANCE, signal);
  }

  /**
   * Получение аналитических данных
   * @param {Object} params - Параметры запроса
   * @returns {Promise<any>} - Аналитические данные
   */
  getAnalyticsData(params) {
    // Добавляем timestamp для избежания кэширования
    const requestParams = { ...params, _t: Date.now() };
    return this.get(API_PATHS.ANALYTICS_DATA, requestParams);
  }

  /**
   * Создание новой сетки
   * @param {Object} params - Параметры сетки
   * @returns {Promise<any>} - Результат создания
   */
  createGrid(params) {
    // Очищаем кэш сеток
    this.clearCache('activeGrids');
    return this.post(API_PATHS.SMART_GRID_CREATE, params);
  }

  /**
   * Получение списка активных сеток
   * @returns {Promise<any>} - Список активных сеток
   */
  getActiveGrids() {
    return this.get(API_PATHS.SMART_GRID_ACTIVE, { _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.grids)) {
          return response.grids;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.SMART_GRID_ACTIVE:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getActiveGrids:', error);
        return [];
      });
  }

  /**
   * Получение истории сеток
   * @returns {Promise<any>} - История сеток
   */
  getGridHistory() {
    return this.get(API_PATHS.SMART_GRID_HISTORY, { _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.history)) {
          return response.history;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.SMART_GRID_HISTORY:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getGridHistory:', error);
        return [];
      });
  }

  /**
   * Закрытие сетки
   * @param {string} id - ID сетки
   * @returns {Promise<any>} - Результат закрытия
   */
  closeGrid(id) {
    // Очищаем кэш сеток
    this.clearCache('activeGrids');
    return this.post(`${API_PATHS.SMART_GRID_CLOSE}/${id}/close`);
  }

  /**
   * Получение активных позиций
   * @returns {Promise<any>} - Список активных позиций
   */
  getActivePositions() {
    return this.get(API_PATHS.ACTIVE_POSITIONS, { _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.positions)) {
          return response.positions;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.ACTIVE_POSITIONS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getActivePositions:', error);
        return [];
      });
  }
  
  /**
   * Получение списка модулей
   * @returns {Promise<any>} - Список модулей
   */
  getModules() {
    return this.get(API_PATHS.MODULES);
  }
  
  // ====== API ИНДИКАТОРОВ ======
  
  /**
   * Получение списка индикаторов
   * @returns {Promise<any>} - Список индикаторов
   */
  getIndicators() {
    return this.get(API_PATHS.INDICATORS, { _t: Date.now() })
      .then(response => {
        if (response && Array.isArray(response.indicators)) {
          return response.indicators;
        } else if (response && Array.isArray(response)) {
          return response;
        } else {
          console.warn('Неожиданный формат данных от API_PATHS.INDICATORS:', response);
          return [];
        }
      })
      .catch(error => {
        console.error('Ошибка в getIndicators:', error);
        return [];
      });
  }
  
  /**
   * Получение конкретного индикатора
   * @param {string} id - ID индикатора
   * @returns {Promise<any>} - Данные индикатора
   */
  getIndicator(id) {
    return this.get(`${API_PATHS.INDICATORS}/${id}`, { _t: Date.now() });
  }
  
  /**
   * Управление видимостью индикатора
   * @param {string} id - ID индикатора
   * @param {boolean} visible - Видимость индикатора
   * @returns {Promise<any>} - Результат
   */
  setIndicatorVisibility(id, visible) {
    // Очищаем кэш индикаторов
    this.clearCache('indicators');
    this.clearCache(`visibleIndicatorsData_`);
    return this.post(`${API_PATHS.INDICATORS}/${id}/visibility`, { visible });
  }
  
  /**
   * Обновление конфигурации индикатора
   * @param {string} id - ID индикатора
   * @param {Object} config - Новая конфигурация
   * @returns {Promise<any>} - Результат
   */
  updateIndicatorConfig(id, config) {
    // Очищаем кэш индикаторов
    this.clearCache('indicators');
    this.clearCache(`indicatorData_${id}`);
    return this.post(`${API_PATHS.INDICATORS}/${id}/config`, config);
  }
  
  /**
   * Получение визуальных данных всех видимых индикаторов
   * @returns {Promise<any>} - Визуальные данные
   */
  getIndicatorsVisualData() {
    return this.get(API_PATHS.INDICATORS_VISUAL_DATA, { _t: Date.now() });
  }
  
  /**
   * Изменение символа графика
   * @param {string} symbol - Символ торговой пары
   * @returns {Promise<any>} - Результат изменения
   */
  changeChartSymbol(symbol) {
    // Очищаем кэш данных графика при смене символа
    this.clearCache(`chartData_${symbol}`);
    this.clearCache(`chart`);
    return this.post(API_PATHS.CHART_SYMBOL, { symbol });
  }
  
  /**
   * Изменение интервала графика
   * @param {string} interval - Временной интервал
   * @returns {Promise<any>} - Результат изменения
   */
  changeChartInterval(interval) {
    // Очищаем кэш данных графика при смене интервала
    this.clearCache(`chartData_`);
    this.clearCache(`chart`);
    return this.post(API_PATHS.CHART_INTERVAL, { interval });
  }
  
  /**
   * Изменение темы графика
   * @param {string} theme - Тема ('dark' или 'light')
   * @returns {Promise<any>} - Результат изменения
   */
  changeChartTheme(theme) {
    return this.post(API_PATHS.CHART_THEME, { theme });
  }
  
  /**
   * Получение информации о графике
   * @returns {Promise<any>} - Информация о графике
   */
  getChartInfo() {
    return this.get(API_PATHS.CHART_INFO, { _t: Date.now() });
  }
  
  /**
   * Получение данных конкретного индикатора
   * @param {string} id - ID индикатора
   * @param {Object} params - Параметры запроса
   * @returns {Promise<any>} - Данные индикатора
   */
  getIndicatorData(id, params) {
    // Добавляем timestamp для избежания кэширования
    const requestParams = { ...params, _t: Date.now() };
    return this.get(`${API_PATHS.CHART_INDICATOR}/${id}`, requestParams);
  }
  
  /**
   * Получение данных всех видимых индикаторов
   * @param {Object} params - Параметры запроса
   * @returns {Promise<any>} - Данные индикаторов
   */
  getVisibleIndicatorsData(params) {
    // Добавляем timestamp для избежания кэширования
    const requestParams = { ...params, _t: Date.now() };
    
    return this.get(API_PATHS.CHART_INDICATORS_VISIBLE, requestParams)
      .then(response => {
        // Проверка структуры ответа и адаптация к ожидаемому формату
        if (!response) return {};
        
        if (response.visualData) {
          return { visualData: response.visualData };
        } else if (typeof response === 'object' && !Array.isArray(response)) {
          return { visualData: response }; // Используем весь объект как visualData
        }
        
        return { visualData: {} };
      })
      .catch(error => {
        console.error('Ошибка при получении данных индикаторов:', error);
        return { visualData: {} };
      });
  }
  
  /**
   * Анализ графика с помощью AI
   * @param {Object} params - Параметры анализа
   * @returns {Promise<any>} - Результат анализа
   */
  analyzeChart(params) {
    return this.post(API_PATHS.AI_ANALYZER, params);
  }

  // Групповой метод для загрузки начальных данных
  async initializeAppData() {
    // Создаем объект для результатов
    const results = {};
    
    try {
      // Устанавливаем режим принудительного обновления данных
      const forceRefresh = true;
      
      // Очищаем весь кэш для получения актуальных данных
      this.clearCache();
      
      // Загружаем статус системы
      results.status = await this.get(API_PATHS.STATUS, { _t: Date.now() });
      
      // Загружаем настройки
      results.settings = await this.get(API_PATHS.SETTINGS, { _t: Date.now() });
      
      // Загружаем список бирж
      const exchangesResponse = await this.get(API_PATHS.EXCHANGES, { _t: Date.now() });
      results.exchanges = exchangesResponse?.exchanges || [];
      
      // Загружаем список пар для текущей биржи
      if (results.status && results.status.core) {
        const exchange = results.status.core.exchange || 'bitget';
        results.pairs = await this.getPairs(exchange, 'spot');
      }
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Ошибка при инициализации данных приложения:', error);
      return {
        success: false,
        error: error.message,
        data: results
      };
    }
  }
}

// Создаем экземпляр сервиса
const apiService = new ApiService();

// Настройка для отладки (если нужно)
// apiService.enableDebugLogs = true;

// Добавляем глобальный обработчик ошибок на уровне window
window.addEventListener('error', function(event) {
  // Логируем ошибки, но не позволяем им остановить приложение
  console.error('Глобальная ошибка:', event.error);
  
  // Если это ошибка ресурсов, предотвращаем падение приложения
  if (event.message && event.message.includes('ERR_INSUFFICIENT_RESOURCES')) {
    event.preventDefault();
    console.warn('Обнаружена ошибка нехватки ресурсов, приостанавливаем запросы на 5 секунд');
    // Глобальная пауза для всех запросов
    window._pauseAllRequests = true;
    setTimeout(() => {
      window._pauseAllRequests = false;
    }, 5000);
  }
});

export default apiService;