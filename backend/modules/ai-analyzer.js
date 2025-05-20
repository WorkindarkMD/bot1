// modules/ai-analyzer.js - Улучшенный модуль AI анализа графиков

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Модуль AI анализа графиков
 * Отвечает за анализ графиков с помощью AI и генерацию торговых сигналов
 */
class AIAnalyzerModule {
  /**
   * Создает новый экземпляр модуля AI анализатора
   * @param {Object} config - Конфигурация модуля
   */
  constructor(config) {
    // Метаданные модуля
    this.name = 'AI анализатор графиков';
    this.description = 'Модуль для анализа графиков с помощью AI и генерации торговых сигналов';
    
    // Конфигурация
    this.config = this._initConfig(config || {});
    
    // Состояние модуля
    this.core = null;
    this.isInitialized = false;
    this.activeJobs = new Map(); // Отслеживание активных задач анализа
    
    // Кэш волатильности для расчета уровней TP/SL
    this.volatilityCache = {};
    
    // HTTP клиент для взаимодействия с AI API
    this.httpClient = null;
    
    // Браузер для создания скриншотов
    this.browser = null;
    
    // Директория для хранения скриншотов
    this.screenshotDir = path.join(process.cwd(), 'screenshots');
    
    // Обработчики событий
    this.eventHandlers = {};
  }

  /**
   * Инициализирует конфигурацию по умолчанию
   * @param {Object} config - Конфигурация из конструктора
   * @returns {Object} - Инициализированная конфигурация
   * @private
   */
  _initConfig(config) {
    return {
      // Конфигурация API
      apiKey: config.apiKey || '',
      endpoint: config.endpoint || 'https://api.example.com/analyze',
      model: config.model || 'default-model',
      
      // Настройки скриншотов
      screenshotWidth: config.screenshotWidth || 1280,
      screenshotHeight: config.screenshotHeight || 800,
      screenshotQuality: config.screenshotQuality || 80,
      
      // Повторные попытки и тайм-ауты
      maxRetries: config.maxRetries || 3,
      requestTimeout: config.requestTimeout || 30000, // 30 секунд
      
      // Другие настройки
      serverPort: config.serverPort || 3000,
      defaultPair: config.defaultPair || 'BTCUSDT',
      includeIndicatorsInScreenshot: config.includeIndicatorsInScreenshot !== false,
      indicatorsToInclude: config.indicatorsToInclude || ['rsi', 'macd', 'volume'],
      
      // Объединяем с остальными настройками
      ...config
    };
  }

  /**
   * Инициализация модуля
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   * @throws {Error} Если возникла ошибка при инициализации
   */
  async initialize(core) {
    try {
      this.log('Инициализация модуля AI анализатора...');
      this.core = core;
      
      // Проверка наличия необходимых параметров конфигурации
      this._validateConfig();
      
      // Инициализация HTTP клиента
      this._initHttpClient();
      
      // Создание директории для скриншотов
      await this._ensureScreenshotDirectory();
      
      // Инициализация браузера для создания скриншотов
      await this._initBrowser();
      
      // Регистрируем обработчики событий ядра
      this._registerEventHandlers();
      
      this.isInitialized = true;
      this.log('Модуль AI анализатора успешно инициализирован');
      
      return true;
    } catch (error) {
      this.logError('Ошибка инициализации модуля AI анализатора', error);
      throw error;
    }
  }

  /**
   * Проверяет корректность конфигурации
   * @private
   * @throws {Error} Если конфигурация некорректна
   */
  _validateConfig() {
    if (!this.config.endpoint) {
      throw new Error('Не указан эндпоинт API для AI сервиса');
    }
    
    if (!this.config.apiKey) {
      this.log('Предупреждение: Не указан API ключ для AI сервиса, функциональность будет ограничена', 'warn');
    }
  }

  /**
   * Инициализирует HTTP клиент для взаимодействия с AI API
   * @private
   */
  _initHttpClient() {
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.requestTimeout
    });
    
    // Добавляем перехватчик для обработки ошибок
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        // Логируем ошибку и добавляем контекст
        if (error.response) {
          // Ошибка от сервера
          this.logError(`Ошибка API (${error.response.status}): ${error.response.data.message || error.message}`);
        } else if (error.request) {
          // Нет ответа от сервера
          this.logError(`Нет ответа от AI API: ${error.message}`);
        } else {
          // Ошибка при формировании запроса
          this.logError(`Ошибка запроса к AI API: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Создает директорию для скриншотов, если она не существует
   * @returns {Promise<void>}
   * @private
   */
  async _ensureScreenshotDirectory() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      this.log(`Директория для скриншотов создана: ${this.screenshotDir}`);
    } catch (error) {
      // Игнорируем ошибку, если директория уже существует
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Инициализирует браузер для создания скриншотов
   * @returns {Promise<void>}
   * @private
   */
  async _initBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      this.log('Браузер для создания скриншотов инициализирован');
    } catch (error) {
      this.logError('Ошибка при инициализации браузера', error);
      throw new Error(`Не удалось инициализировать браузер: ${error.message}`);
    }
  }

  /**
   * Регистрирует обработчики событий ядра
   * @private
   */
  _registerEventHandlers() {
    if (!this.core) return;
    
    // Обработчик изменения торговой пары
    this._addEventHandler('tradingPair.changed', this._onTradingPairChanged.bind(this));
    
    // Обработчик завершения работы системы
    this._addEventHandler('system.shutdown', this._onSystemShutdown.bind(this));
  }

  /**
   * Добавляет обработчик события
   * @param {string} eventType - Тип события
   * @param {Function} handler - Функция-обработчик
   * @private
   */
  _addEventHandler(eventType, handler) {
    if (!this.core) return;
    
    // Сохраняем обработчик для возможности отписки
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    
    this.eventHandlers[eventType].push(handler);
    
    // Подписываемся на событие
    this.core.on(eventType, handler);
  }

  /**
   * Обработчик изменения торговой пары
   * @param {Object} data - Данные события
   * @private
   */
  _onTradingPairChanged(data) {
    this.log(`Изменение торговой пары на ${data.newPair}`);
    // Здесь можно выполнить необходимые действия при изменении пары
  }

  /**
   * Обработчик завершения работы системы
   * @private
   */
  _onSystemShutdown() {
    this.log('Получено событие завершения работы системы');
    this.cleanup()
      .then(() => this.log('Выгрузка модуля AI анализатора завершена'))
      .catch(error => this.logError('Ошибка при выгрузке модуля AI анализатора', error));
  }

  /**
   * Создание скриншота графика
   * @param {string} url - URL страницы с графиком
   * @returns {Promise<Object>} - Информация о скриншоте (путь и имя файла)
   * @throws {Error} Если возникла ошибка при создании скриншота
   */
  async createChartScreenshot(url) {
    if (!this.browser) {
      throw new Error('Браузер не инициализирован');
    }
    
    this.log(`Создание скриншота графика: ${url}`);
    
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // Устанавливаем размер viewport
      await page.setViewport({ 
        width: this.config.screenshotWidth, 
        height: this.config.screenshotHeight 
      });
      
      // Переходим на страницу с графиком
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      
      // Ожидаем загрузки графика с увеличенным таймаутом
      let chartElement = null;
      
      try {
        await page.waitForSelector('#trading-chart', { 
          timeout: 60000, 
          visible: true 
        });
        
        chartElement = await page.$('#trading-chart');
      } catch (error) {
        this.log('Не удалось найти элемент #trading-chart, попробуем использовать другой селектор');
        
        try {
          await page.waitForSelector('.chart-container', { 
            timeout: 30000, 
            visible: true 
          });
          
          chartElement = await page.$('.chart-container');
        } catch (innerError) {
          this.log('Не удалось найти элемент .chart-container, будет сделан скриншот всей страницы');
        }
      }
      
      // Создаем имя файла скриншота
      const timestamp = Date.now();
      const pair = this.core.config.tradingPair || 'unknown';
      const fileName = `${pair}_${timestamp}.png`;
      const filePath = path.join(this.screenshotDir, fileName);
      
      // Делаем скриншот элемента графика или всей страницы
      if (chartElement) {
        await chartElement.screenshot({ 
          path: filePath,
          quality: this.config.screenshotQuality
        });
      } else {
        // Если не смогли найти элемент графика, делаем скриншот всей страницы
        await page.screenshot({ 
          path: filePath,
          quality: this.config.screenshotQuality
        });
      }
      
      this.log(`Скриншот создан: ${filePath}`);
      
      return {
        path: filePath,
        fileName: fileName
      };
    } catch (error) {
      this.logError('Ошибка при создании скриншота', error);
      throw new Error(`Не удалось создать скриншот: ${error.message}`);
    } finally {
      // Обязательно закрываем страницу в любом случае
      if (page) {
        await page.close().catch(e => this.logError('Ошибка при закрытии страницы браузера', e));
      }
    }
  }

  /**
   * Анализ графика с помощью AI
   * @param {string} screenshotPath - Путь к файлу скриншота
   * @param {string} [additionalText=''] - Дополнительный текст для анализа
   * @returns {Promise<Object>} - Результат анализа
   * @throws {Error} Если возникла ошибка при анализе
   */
  async analyzeChart(screenshotPath, additionalText = '') {
    if (!this.isInitialized) {
      throw new Error('Модуль не инициализирован');
    }
    
    this.log(`Анализ графика: ${screenshotPath}`);
    
    try {
      // Проверяем существование файла
      try {
        await fs.access(screenshotPath);
      } catch (error) {
        throw new Error(`Файл скриншота не найден: ${screenshotPath}`);
      }
      
      // Читаем файл как бинарные данные
      const imageBuffer = await fs.readFile(screenshotPath);
      
      // Кодируем в base64
      const base64Image = imageBuffer.toString('base64');
      
      // Формируем запрос к AI API с учетом повторных попыток
      return await this._makeApiRequestWithRetry(async () => {
        const payload = {
          image: base64Image,
          text: additionalText,
          tradingPair: this.core.config.tradingPair,
          indicators: this.config.includeIndicatorsInScreenshot ? this.config.indicatorsToInclude : []
        };
        
        const response = await this.httpClient.post('/analyze', payload);
        return response.data;
      });
    } catch (error) {
      this.logError('Ошибка при анализе графика', error);
      throw new Error(`Не удалось проанализировать график: ${error.message}`);
    }
  }

  /**
   * Выполнение запроса с повторными попытками в случае ошибки
   * @param {Function} requestFn - Функция, выполняющая запрос
   * @returns {Promise<Object>} - Результат запроса
   * @private
   */
  async _makeApiRequestWithRetry(requestFn) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Проверяем, имеет ли смысл повторять запрос
        const shouldRetry = this._shouldRetryRequest(error, attempt);
        
        if (!shouldRetry) {
          break;
        }
        
        // Ждем перед следующей попыткой с экспоненциальной задержкой
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.log(`Повторная попытка ${attempt}/${this.config.maxRetries} через ${delay}мс`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Превышено максимальное количество попыток');
  }

  /**
   * Проверяет, нужно ли повторить запрос
   * @param {Error} error - Объект ошибки
   * @param {number} attempt - Номер текущей попытки
   * @returns {boolean} - true, если нужно повторить запрос
   * @private
   */
  _shouldRetryRequest(error, attempt) {
    // Не повторяем запрос при последней попытке
    if (attempt >= this.config.maxRetries) {
      return false;
    }
    
    // Повторяем запрос при ошибках сети и временных ошибках сервера
    if (!error.response) {
      // Ошибка сети
      return true;
    }
    
    // Повторяем только при определенных кодах ошибок (5xx, 429)
    const statusCode = error.response.status;
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Генерация торгового сигнала на основе анализа
   * @param {Object} analysisResult - Результат анализа
   * @returns {Object} - Торговый сигнал
   * @throws {Error} Если не удалось сгенерировать сигнал
   */
  generateTradingSignal(analysisResult) {
    this.log('Генерация торгового сигнала');
    
    try {
      // Извлекаем основные параметры из результата анализа
      const { direction, entryPoint, stopLoss, takeProfit, confidence, analysis } = analysisResult;
      
      // Проверяем наличие всех необходимых параметров
      if (!direction || !entryPoint || !stopLoss || !takeProfit) {
        throw new Error('Не все параметры сигнала получены от AI');
      }
      
      // Формируем сигнал
      const signal = {
        pair: this.core.config.tradingPair,
        direction: direction.toUpperCase(), // BUY или SELL
        entryPoint: parseFloat(entryPoint),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        confidence: parseFloat(confidence || 0),
        analysis: analysis || 'Нет дополнительного анализа',
        timestamp: Date.now(),
        source: 'ai-analyzer'
      };
      
      this.log(`Сгенерирован сигнал: ${JSON.stringify(signal)}`);
      
      // Публикуем сигнал через систему событий
      if (this.core) {
        this.core.emit('trading-signal', { signal });
      }
      
      return signal;
    } catch (error) {
      this.logError('Ошибка при генерации торгового сигнала', error);
      throw error;
    }
  }

  /**
   * Получение сигнала на основе анализа графика для текущей торговой пары
   * @param {Object} [options={}] - Дополнительные опции
   * @returns {Promise<Object>} - Объект с сигналом, анализом и информацией о скриншоте
   * @throws {Error} Если возникла ошибка
   */
  async getSignalForCurrentChart(options = {}) {
    this.log('Получение сигнала для текущего графика');
    
    // Генерируем уникальный ID для этой задачи
    const jobId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Проверяем наличие выбранной торговой пары
    if (!this.core.config.tradingPair) {
      throw new Error('Не выбрана торговая пара');
    }
    
    try {
      // Добавляем задачу в список активных
      this.activeJobs.set(jobId, {
        status: 'running',
        startTime: Date.now(),
        pair: this.core.config.tradingPair
      });
      
      // URL страницы с графиком
      const chartUrl = `http://localhost:${this.config.serverPort || 3000}/chart?pair=${this.core.config.tradingPair}`;
      
      // Создаем скриншот
      const screenshotInfo = await this.createChartScreenshot(chartUrl);
      
      // Формируем дополнительный текст с описанием стратегии (если предоставлено)
      const additionalText = options.strategy ? 
        `Анализируйте график с точки зрения стратегии: ${options.strategy}` : '';
      
      // Анализируем с помощью AI
      const analysisResult = await this.analyzeChart(screenshotInfo.path, additionalText);
      
      // Генерируем сигнал
      const signal = this.generateTradingSignal(analysisResult);
      
      // Обновляем статус задачи
      this.activeJobs.set(jobId, {
        status: 'completed',
        startTime: this.activeJobs.get(jobId).startTime,
        endTime: Date.now(),
        pair: this.core.config.tradingPair,
        result: {
          signal: signal.direction,
          confidence: signal.confidence
        }
      });
      
      return {
        jobId,
        signal,
        analysis: analysisResult,
        screenshot: screenshotInfo.fileName
      };
    } catch (error) {
      // Обновляем статус задачи в случае ошибки
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.set(jobId, {
          status: 'failed',
          startTime: this.activeJobs.get(jobId).startTime,
          endTime: Date.now(),
          pair: this.core.config.tradingPair,
          error: error.message
        });
      }
      
      this.logError('Ошибка при получении сигнала', error);
      throw error;
    } finally {
      // Удаляем задачу из списка активных через некоторое время
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000); // 1 час
    }
  }

  /**
   * Получение уровней TP/SL для сигнала
   * @param {string} pair - Торговая пара
   * @param {string} direction - Направление (BUY или SELL)
   * @param {number} entryPrice - Цена входа
   * @returns {Promise<Object>} - Объект с уровнями TP и SL
   */
  async getSignalLevels(pair, direction, entryPrice) {
    this.log(`Определение уровней TP/SL для ${pair} ${direction} (вход: ${entryPrice})`);
    
    try {
      // Создаем базовый сигнал для определения уровней
      const signal = {
        pair,
        direction,
        entryPoint: entryPrice
      };
      
      // Получаем данные графика для анализа
      const chartData = await this.core.getChartData({
        symbol: pair,
        interval: '1h',
        limit: 200
      });
      
      // Если есть данные графика, используем их для расчета уровней
      if (chartData && chartData.length > 0) {
        // Создаем дополнительный текст для анализа
        const additionalText = `Analyze this ${pair} chart and recommend optimal Stop Loss and Take Profit levels for a ${direction} position with entry at ${entryPrice}.`;
        
        // URL страницы с графиком
        const chartUrl = `http://localhost:${this.config.serverPort || 3000}/chart?pair=${pair}`;
        
        // Создаем скриншот
        const screenshotInfo = await this.createChartScreenshot(chartUrl);
        
        // Анализируем с помощью AI
        const analysisResult = await this.analyzeChart(screenshotInfo.path, additionalText);
        
        // Извлекаем уровни из результата анализа
        const levels = this._extractLevelsFromAnalysis(analysisResult, signal);
        
        if (levels.stopLoss && levels.takeProfit) {
          this.log(`AI определил уровни для ${pair}: SL=${levels.stopLoss}, TP=${levels.takeProfit}`);
          return levels;
        }
      }
      
      // Если не удалось определить уровни через AI, используем технический анализ
      const taLevels = this._calculateLevelsByTA(signal);
      this.log(`Рассчитаны технические уровни для ${pair}: SL=${taLevels.stopLoss}, TP=${taLevels.takeProfit}`);
      
      return taLevels;
    } catch (error) {
      this.logError(`Ошибка при определении уровней TP/SL для ${pair}`, error);
      
      // В случае ошибки используем базовый расчет на основе ТА
      const signal = {
        pair,
        direction,
        entryPoint: entryPrice
      };
      
      return this._calculateLevelsByTA(signal);
    }
  }

  /**
   * Анализ нескольких таймфреймов для подтверждения сигнала
   * @param {string} pair - Торговая пара
   * @param {string} strategy - Стратегия анализа
   * @param {string[]} timeframes - Массив таймфреймов для анализа
   * @returns {Promise<Object>} - Результат анализа
   */
  async analyzeMultiTimeframe(pair, strategy, timeframes = ['15m', '1h', '4h']) {
    this.log(`Мультитаймфрейм анализ для ${pair} (стратегия: ${strategy})`);
    
    try {
      const signals = [];
      
      // Анализируем каждый таймфрейм
      for (const timeframe of timeframes) {
        try {
          // Формируем URL для графика с указанным таймфреймом
          const chartUrl = `http://localhost:${this.config.serverPort || 3000}/chart?pair=${pair}&interval=${timeframe}`;
          
          // Создаем скриншот
          const screenshotInfo = await this.createChartScreenshot(chartUrl);
          
          // Дополнительный текст с указанием таймфрейма и стратегии
          const additionalText = `Analyze this ${pair} chart on ${timeframe} timeframe using ${strategy} strategy. Provide trading signal with entry point, stop loss and take profit levels.`;
          
          // Анализируем с помощью AI
          const analysisResult = await this.analyzeChart(screenshotInfo.path, additionalText);
          
          // Генерируем сигнал
          const signal = this.generateTradingSignal(analysisResult);
          
          // Добавляем информацию о таймфрейме
          signal.timeframe = timeframe;
          
          signals.push(signal);
        } catch (error) {
          this.logError(`Ошибка при анализе таймфрейма ${timeframe} для ${pair}`, error);
          // Продолжаем с другими таймфреймами
        }
      }
      
      // Определяем консенсусный сигнал
      const consensusResult = this._determineConsensusSignal(signals);
      
      return {
        confirmed: consensusResult.confirmed,
        signal: consensusResult.signal,
        confidence: consensusResult.confidence,
        signals: signals,
        timeframes: timeframes,
        pair
      };
    } catch (error) {
      this.logError(`Ошибка при мультитаймфрейм анализе для ${pair}`, error);
      throw error;
    }
  }
  
  /**
   * Определяет консенсусный сигнал на основе нескольких сигналов
   * @param {Array} signals - Массив сигналов
   * @returns {Object} - Консенсусный сигнал
   * @private
   */
  _determineConsensusSignal(signals) {
    if (!signals || signals.length === 0) {
      return { confirmed: false, signal: null, confidence: 0 };
    }
    
    // Считаем количество сигналов каждого направления
    const buySignals = signals.filter(s => s.direction === 'BUY');
    const sellSignals = signals.filter(s => s.direction === 'SELL');
    
    // Расчет средней уверенности для каждого направления
    const buyConfidence = buySignals.length > 0 ? 
      buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length : 0;
    
    const sellConfidence = sellSignals.length > 0 ? 
      sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length : 0;
    
    // Определяем, есть ли консенсус (более 50% сигналов одного направления)
    const totalSignals = signals.length;
    const buyRatio = buySignals.length / totalSignals;
    const sellRatio = sellSignals.length / totalSignals;
    
    // Считаем консенсус подтвержденным, если более 66% сигналов одного направления
    const consensusThreshold = 0.66;
    
    if (buyRatio >= consensusThreshold) {
      // Консенсус BUY
      // Выбираем сигнал с наилучшим соотношением риск/прибыль среди BUY сигналов
      const bestBuySignal = this._selectBestSignal(buySignals);
      
      return {
        confirmed: true,
        signal: {
          ...bestBuySignal,
          confidence: buyConfidence,
          consensusStrength: buyRatio
        },
        confidence: buyConfidence
      };
    } else if (sellRatio >= consensusThreshold) {
      // Консенсус SELL
      // Выбираем сигнал с наилучшим соотношением риск/прибыль среди SELL сигналов
      const bestSellSignal = this._selectBestSignal(sellSignals);
      
      return {
        confirmed: true,
        signal: {
          ...bestSellSignal,
          confidence: sellConfidence,
          consensusStrength: sellRatio
        },
        confidence: sellConfidence
      };
    } else {
      // Нет четкого консенсуса
      return {
        confirmed: false,
        signal: signals[0], // Возвращаем первый сигнал как пример
        confidence: Math.max(buyConfidence, sellConfidence)
      };
    }
  }
  
  /**
   * Выбирает лучший сигнал из массива на основе соотношения риск/прибыль
   * @param {Array} signals - Массив сигналов
   * @returns {Object} - Лучший сигнал
   * @private
   */
  _selectBestSignal(signals) {
    if (!signals || signals.length === 0) {
      return null;
    }
    
    // Вычисляем соотношение риск/прибыль для каждого сигнала
    const signalsWithRR = signals.map(signal => {
      const entryPrice = parseFloat(signal.entryPoint);
      const stopLoss = parseFloat(signal.stopLoss);
      const takeProfit = parseFloat(signal.takeProfit);
      
      let risk, reward;
      
      if (signal.direction === 'BUY') {
        risk = entryPrice - stopLoss;
        reward = takeProfit - entryPrice;
      } else {
        risk = stopLoss - entryPrice;
        reward = entryPrice - takeProfit;
      }
      
      const rr = risk > 0 ? reward / risk : 0;
      
      return {
        ...signal,
        riskRewardRatio: rr
      };
    });
    
    // Сортируем по убыванию соотношения риск/прибыль
    signalsWithRR.sort((a, b) => b.riskRewardRatio - a.riskRewardRatio);
    
    // Возвращаем сигнал с лучшим соотношением
    return signalsWithRR[0];
  }

  /**
   * Улучшенная версия метода извлечения уровней TP/SL из результата анализа AI
   * @param {Object} analysisResult - Результат анализа AI
   * @param {Object} signal - Исходный сигнал
   * @returns {Object} - Извлеченные уровни
   * @private
   */
  _extractLevelsFromAnalysis(analysisResult, signal) {
    this.log(`Извлечение уровней TP/SL из анализа для ${signal.pair} ${signal.direction}`);
    
    let stopLoss = null;
    let takeProfit = null;

    try {
      // 1. Пытаемся найти структурированные данные (JSON)
      const jsonMatches = [
        // Ищем блок кода JSON
        analysisResult.match(/```json\s*([\s\S]*?)\s*```/),
        // Ищем объект с ключами stopLoss и takeProfit
        analysisResult.match(/\{[\s\S]*?"stopLoss"[\s\S]*?"takeProfit"[\s\S]*?\}/),
        // Ищем объект с одинарными кавычками
        analysisResult.match(/\{[\s\S]*?'stopLoss'[\s\S]*?'takeProfit'[\s\S]*?\}/),
        // Ищем уровни в формате key: value
        analysisResult.match(/stopLoss[:\s]+([0-9.]+)[\s\S]*?takeProfit[:\s]+([0-9.]+)/)
      ];

      // Обрабатываем найденные совпадения
      for (const match of jsonMatches) {
        if (match) {
          try {
            // Если это JSON-объект
            if (match[0].startsWith('{')) {
              const levelsJson = JSON.parse(match[0].replace(/'/g, '"'));
              stopLoss = parseFloat(levelsJson.stopLoss);
              takeProfit = parseFloat(levelsJson.takeProfit);
              break;
            } 
            // Если это формат key: value
            else if (match.length >= 3) {
              stopLoss = parseFloat(match[1]);
              takeProfit = parseFloat(match[2]);
              break;
            }
            // Если это блок кода JSON
            else if (match[1]) {
              const levelsJson = JSON.parse(match[1]);
              stopLoss = parseFloat(levelsJson.stopLoss);
              takeProfit = parseFloat(levelsJson.takeProfit);
              break;
            }
          } catch (parseError) {
            this.log(`Ошибка парсинга JSON при извлечении уровней: ${parseError.message}`);
            // Продолжаем цикл, чтобы проверить следующее совпадение
          }
        }
      }

      // 2. Если структурированных данных не найдено, ищем числовые значения по ключевым словам
      if (!stopLoss || !takeProfit) {
        // Для стоп-лосса ищем различные варианты написания
        const stopLossMatches = [
          analysisResult.match(/stop\s*loss\s*[^\d]+([\d.]+)/i),
          analysisResult.match(/sl[^\d]+([\d.]+)/i),
          analysisResult.match(/stop[^\d]+([\d.]+)/i),
          analysisResult.match(/уровень\s*останов[^\d]+([\d.]+)/i),      // Русскоязычные варианты
          analysisResult.match(/стоп\s*лосс[^\d]+([\d.]+)/i),
          analysisResult.match(/стоп[^\d]+([\d.]+)/i)
        ];

        // Для тейк-профита ищем различные варианты написания
        const takeProfitMatches = [
          analysisResult.match(/take\s*profit\s*[^\d]+([\d.]+)/i),
          analysisResult.match(/tp[^\d]+([\d.]+)/i),
          analysisResult.match(/profit\s*target[^\d]+([\d.]+)/i),
          analysisResult.match(/take[^\d]+([\d.]+)/i),
          analysisResult.match(/уровень\s*прибыли[^\d]+([\d.]+)/i),     // Русскоязычные варианты
          analysisResult.match(/тейк\s*профит[^\d]+([\d.]+)/i),
          analysisResult.match(/профит[^\d]+([\d.]+)/i)
        ];

        // Проверяем найденные совпадения для стоп-лосса
        for (const match of stopLossMatches) {
          if (match && match[1]) {
            stopLoss = parseFloat(match[1]);
            if (!isNaN(stopLoss)) break;
          }
        }

        // Проверяем найденные совпадения для тейк-профита
        for (const match of takeProfitMatches) {
          if (match && match[1]) {
            takeProfit = parseFloat(match[1]);
            if (!isNaN(takeProfit)) break;
          }
        }
      }

      // 3. Если все еще не нашли, ищем ценовые уровни рядом с ключевыми словами
      if (!stopLoss || !takeProfit) {
        // Ищем все числа в тексте
        const allNumbers = Array.from(analysisResult.matchAll(/[\d.]+/g)).map(m => parseFloat(m[0]));
        
        // Получаем текущую цену из сигнала
        const currentPrice = parseFloat(signal.entryPoint);
        
        if (allNumbers.length > 0 && !isNaN(currentPrice)) {
          // Сортируем числа по близости к текущей цене
          allNumbers.sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice));
          
          // Находим числа ниже и выше текущей цены
          const lowerNumbers = allNumbers.filter(n => n < currentPrice).sort((a, b) => b - a);
          const higherNumbers = allNumbers.filter(n => n > currentPrice).sort((a, b) => a - b);
          
          if (signal.direction === 'BUY') {
            // Для BUY: SL ниже текущей цены, TP выше
            if (!stopLoss && lowerNumbers.length > 0) {
              stopLoss = lowerNumbers[0];
            }
            if (!takeProfit && higherNumbers.length > 0) {
              takeProfit = higherNumbers[0];
            }
          } else {
            // Для SELL: SL выше текущей цены, TP ниже
            if (!stopLoss && higherNumbers.length > 0) {
              stopLoss = higherNumbers[0];
            }
            if (!takeProfit && lowerNumbers.length > 0) {
              takeProfit = lowerNumbers[0];
            }
          }
        }
      }

      // 4. Проверяем валидность найденных значений
      if (stopLoss && takeProfit) {
        // Проверка разумности значений - они должны быть в пределах ±30% от цены входа
        const entryPrice = parseFloat(signal.entryPoint);
        const maxDeviation = entryPrice * 0.3;

        if (Math.abs(stopLoss - entryPrice) > maxDeviation || Math.abs(takeProfit - entryPrice) > maxDeviation) {
          this.logError(`Найденные уровни имеют слишком большое отклонение от цены входа: SL=${stopLoss}, TP=${takeProfit}, Entry=${entryPrice}`);
          return this._calculateLevelsByTA(signal);
        }

        // Проверка логики направления
        if (signal.direction === 'BUY') {
          // Для LONG: SL должен быть ниже входа, TP - выше
          if (stopLoss >= entryPrice || takeProfit <= entryPrice) {
            this.log(`Неправильная логика направления для LONG: SL=${stopLoss}, TP=${takeProfit}, Entry=${entryPrice}`);
            return this._calculateLevelsByTA(signal);
          }
        } else {
          // Для SHORT: SL должен быть выше входа, TP - ниже
          if (stopLoss <= entryPrice || takeProfit >= entryPrice) {
            this.log(`Неправильная логика направления для SHORT: SL=${stopLoss}, TP=${takeProfit}, Entry=${entryPrice}`);
            return this._calculateLevelsByTA(signal);
          }
        }

        this.log(`Успешно извлечены уровни: SL=${stopLoss}, TP=${takeProfit}`);
        return { stopLoss, takeProfit };
      }

      // Если не удалось извлечь валидные уровни, используем технический анализ
      this.log('Не удалось извлечь валидные уровни из анализа, используем технический анализ');
      return this._calculateLevelsByTA(signal);
    } catch (error) {
      this.logError(`Ошибка при извлечении уровней из анализа: ${error.message}`, error);
      return this._calculateLevelsByTA(signal);
    }
  }

  /**
   * Улучшенный метод расчета уровней TP/SL на основе технического анализа
   * @param {Object} signal - Сигнал копитрейдинга
   * @returns {Object} - Рассчитанные уровни
   * @private
   */
  async _calculateLevelsByTA(signal) {
    const entryPrice = parseFloat(signal.entryPoint);
    const leverage = parseInt(signal.leverage || 1, 10);
    
    // Получаем данные о волатильности пары
    let volatilityMultiplier = 1.0;
    try {
      if (this.volatilityCache && this.volatilityCache[signal.pair]) {
        volatilityMultiplier = this.volatilityCache[signal.pair];
      } else {
        // Если нет кэшированных данных о волатильности, попробуем рассчитать
        if (this.core) {
          const chartData = await this.core.getChartData({
            symbol: signal.pair,
            interval: '1h',
            limit: 24
          }).catch(() => null);
          
          if (chartData && chartData.length > 0) {
            // Рассчитываем средний ATR за последние 24 часа
            const atr = this._calculateATR(chartData, 14);
            const avgPrice = chartData.reduce((sum, candle) => sum + candle.close, 0) / chartData.length;
            
            // Нормализуем ATR относительно средней цены
            volatilityMultiplier = (atr / avgPrice) * 100;
            
            // Ограничиваем множитель в разумных пределах
            volatilityMultiplier = Math.max(0.5, Math.min(volatilityMultiplier, 2.5));
            
            // Кэшируем результат
            if (!this.volatilityCache) this.volatilityCache = {};
            this.volatilityCache[signal.pair] = volatilityMultiplier;
          }
        }
      }
    } catch (error) {
      this.log(`Ошибка при расчете волатильности: ${error.message}`);
      // В случае ошибки используем значение по умолчанию
      volatilityMultiplier = 1.0;
    }
    
    // Базовый расчет с учетом риск-менеджмента и волатильности
    // При высоком леверидже - меньшие отступы
    const baseRiskPercent = 1.5 * volatilityMultiplier; 
    const riskPercent = baseRiskPercent / Math.sqrt(leverage);
    const rewardPercent = riskPercent * 2;
    
    let stopLoss, takeProfit;
    
    if (signal.direction === 'BUY') {
      // Для позиций LONG
      stopLoss = entryPrice * (1 - riskPercent / 100);
      takeProfit = entryPrice * (1 + rewardPercent / 100);
    } else {
      // Для позиций SHORT
      stopLoss = entryPrice * (1 + riskPercent / 100);
      takeProfit = entryPrice * (1 - rewardPercent / 100);
    }
    
    // Округляем с учетом возможной малой цены актива
    const precisionDigits = entryPrice < 1 ? 8 : (entryPrice < 10 ? 6 : (entryPrice < 100 ? 4 : 2));
    
    this.log(`Рассчитаны уровни по ТА: SL=${stopLoss.toFixed(precisionDigits)}, TP=${takeProfit.toFixed(precisionDigits)}`);
    
    return {
      stopLoss: parseFloat(stopLoss.toFixed(precisionDigits)),
      takeProfit: parseFloat(takeProfit.toFixed(precisionDigits))
    };
  }

  /**
   * Вспомогательный метод для расчета ATR (Average True Range)
   * @param {Array} chartData - Данные графика
   * @param {number} period - Период ATR
   * @returns {number} - Значение ATR
   * @private
   */
  _calculateATR(chartData, period) {
    if (!chartData || chartData.length < period + 1) {
      return 0;
    }
    
    const trueRanges = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const high = chartData[i].high;
      const low = chartData[i].low;
      const prevClose = chartData[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    // Рассчитываем ATR как среднее значение за период
    const lastTrueRanges = trueRanges.slice(-period);
    return lastTrueRanges.reduce((sum, tr) => sum + tr, 0) / lastTrueRanges.length;
  }

  /**
   * Запуск автоматического анализа с заданным интервалом
   * @param {Object} options - Опции автоматического анализа
   * @param {string[]} options.pairs - Массив торговых пар для анализа
   * @param {string} options.interval - Интервал между анализами (например, '1h', '30m')
   * @param {string} [options.strategy] - Стратегия для анализа
   * @param {boolean} [options.autoTrade=false] - Автоматически исполнять сигналы
   * @returns {Object} - Информация о запущенном автоматическом анализе
   */
  startAutomatedAnalysis(options) {
    if (!options || !options.pairs || !options.pairs.length || !options.interval) {
      throw new Error('Необходимо указать массив торговых пар и интервал');
    }
    
    // Генерируем уникальный ID для задачи автоматического анализа
    const automationId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Преобразуем интервал в миллисекунды
    const intervalMs = this._parseIntervalToMs(options.interval);
    
    if (!intervalMs) {
      throw new Error(`Некорректный формат интервала: ${options.interval}`);
    }
    
    // Создаем функцию для выполнения анализа
    const runAnalysis = async () => {
      // Проходим по всем парам
      for (const pair of options.pairs) {
        try {
          // Устанавливаем текущую пару
          this.core.setTradingPair(pair);
          
          // Небольшая задержка для обновления графика
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Получаем сигнал
          const result = await this.getSignalForCurrentChart({
            strategy: options.strategy
          });
          
          this.log(`Автоматический анализ пары ${pair} завершен: ${result.signal.direction} (${result.signal.confidence})`);
          
          // Если включена автоторговля, исполняем сигнал
          if (options.autoTrade) {
            await this._executeSignal(result.signal);
          }
        } catch (error) {
          this.logError(`Ошибка при автоматическом анализе пары ${pair}`, error);
        }
      }
    };
    
    // Запускаем первый анализ
    runAnalysis();
    
    // Создаем интервал для регулярного анализа
    const intervalId = setInterval(runAnalysis, intervalMs);
    
    // Сохраняем информацию о задаче
    const automationInfo = {
      id: automationId,
      pairs: [...options.pairs],
      interval: options.interval,
      intervalMs,
      strategy: options.strategy,
      autoTrade: options.autoTrade || false,
      startTime: Date.now(),
      intervalId
    };
    
    // Сохраняем в глобальной переменной или в хранилище
    if (!this.automatedAnalysisTasks) {
      this.automatedAnalysisTasks = new Map();
    }
    
    this.automatedAnalysisTasks.set(automationId, automationInfo);
    
    this.log(`Запущен автоматический анализ для ${options.pairs.length} пар с интервалом ${options.interval}`);
    
    // Публикуем событие о запуске автоматического анализа
    if (this.core) {
      this.core.emit('ai-analysis.automated.started', {
        id: automationId,
        pairs: options.pairs,
        interval: options.interval,
        autoTrade: options.autoTrade || false
      });
    }
    
    return {
      id: automationId,
      pairs: options.pairs,
      interval: options.interval,
      startTime: automationInfo.startTime
    };
  }

  /**
   * Остановка автоматического анализа
   * @param {string} automationId - ID задачи автоматического анализа
   * @returns {boolean} - Результат остановки
   */
  stopAutomatedAnalysis(automationId) {
    if (!this.automatedAnalysisTasks || !this.automatedAnalysisTasks.has(automationId)) {
      return false;
    }
    
    const task = this.automatedAnalysisTasks.get(automationId);
    
    // Останавливаем интервал
    clearInterval(task.intervalId);
    
    // Удаляем задачу из списка
    this.automatedAnalysisTasks.delete(automationId);
    
    this.log(`Остановлен автоматический анализ ${automationId}`);
    
    // Публикуем событие об остановке автоматического анализа
    if (this.core) {
      this.core.emit('ai-analysis.automated.stopped', {
        id: automationId,
        pairs: task.pairs,
        runTime: Date.now() - task.startTime
      });
    }
    
    return true;
  }

  /**
   * Получение списка активных задач автоматического анализа
   * @returns {Array} - Список активных задач
   */
  getAutomatedAnalysisTasks() {
    if (!this.automatedAnalysisTasks) {
      return [];
    }
    
    return Array.from(this.automatedAnalysisTasks.values()).map(task => ({
      id: task.id,
      pairs: task.pairs,
      interval: task.interval,
      strategy: task.strategy,
      autoTrade: task.autoTrade,
      startTime: task.startTime,
      runTime: Date.now() - task.startTime
    }));
  }

  /**
   * Выполнение сигнала через модуль автотрейдинга
   * @param {Object} signal - Торговый сигнал
   * @returns {Promise<Object>} - Результат выполнения сигнала
   * @private
   */
  async _executeSignal(signal) {
    if (!this.core) {
      throw new Error('Ядро не инициализировано');
    }
    
    // Получаем модуль автотрейдинга
    const autoTrader = this.core.getModule('auto-trader');
    
    if (!autoTrader) {
      throw new Error('Модуль автотрейдинга не найден');
    }
    
    this.log(`Выполнение сигнала для пары ${signal.pair}: ${signal.direction}`);
    
    try {
      // Вызываем метод обработки сигнала
      const result = await autoTrader.handleNewSignal(signal);
      
      if (!result.success) {
        throw new Error(result.error || 'Неизвестная ошибка при выполнении сигнала');
      }
      
      this.log(`Сигнал успешно выполнен: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logError('Ошибка при выполнении сигнала', error);
      throw error;
    }
  }

  /**
   * Преобразует строковое представление интервала в миллисекунды
   * @param {string} interval - Интервал в формате '1h', '30m', '1d' и т.д.
   * @returns {number|null} - Интервал в миллисекундах или null при ошибке
   * @private
   */
  _parseIntervalToMs(interval) {
    const match = interval.match(/^(\d+)([mhdw])$/);
    
    if (!match) {
      return null;
    }
    
    const [, value, unit] = match;
    const numValue = parseInt(value, 10);
    
    switch (unit) {
      case 'm': // минуты
        return numValue * 60 * 1000;
      case 'h': // часы
        return numValue * 60 * 60 * 1000;
      case 'd': // дни
        return numValue * 24 * 60 * 60 * 1000;
      case 'w': // недели
        return numValue * 7 * 24 * 60 * 60 * 1000;
      default:
        return null;
    }
  }

  /**
   * Очистка ресурсов при выгрузке модуля
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.log('Очистка ресурсов модуля AI анализатора...');
    
    // Остановка всех задач автоматического анализа
    if (this.automatedAnalysisTasks) {
      for (const [id] of this.automatedAnalysisTasks) {
        this.stopAutomatedAnalysis(id);
      }
    }
    
    // Отписка от всех событий
    this._cleanupEventHandlers();
    
    // Закрытие браузера
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
      } catch (error) {
        this.logError('Ошибка при закрытии браузера', error);
      }
    }
    
    this.isInitialized = false;
    this.log('Модуль AI анализатора успешно выгружен');
  }

  /**
   * Очистка обработчиков событий
   * @private
   */
  _cleanupEventHandlers() {
    if (!this.core) return;
    
    // Отписываемся от всех событий
    Object.entries(this.eventHandlers).forEach(([eventType, handlers]) => {
      handlers.forEach(handler => {
        this.core.off(eventType, handler);
      });
    });
    
    // Очищаем список обработчиков
    this.eventHandlers = {};
  }

  /**
   * Предоставление метаданных модуля для API
   * @returns {Object} - Метаданные модуля
   */
  getMetadata() {
    return {
      id: 'ai-analyzer',
      name: this.name,
      description: this.description,
      version: '1.0.0',
      capabilities: [
        'chart_analysis',
        'trading_signals',
        'screenshot_generation',
        'automated_analysis'
      ],
      activeJobs: this.activeJobs.size,
      automatedTasks: this.automatedAnalysisTasks ? this.automatedAnalysisTasks.size : 0
    };
  }

  /**
   * Регистрация API эндпоинтов
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Эндпоинт для запроса анализа текущего графика
    app.post('/api/modules/ai-analyzer/analyze', async (req, res) => {
      this.log('Получен запрос на анализ');
      
      try {
        // Проверяем, передана ли торговая пара в запросе
        const pair = req.body.pair;
        
        // Если пара не выбрана в ядре, но передана в запросе, устанавливаем её
        if (!this.core.config.tradingPair && pair) {
          this.core.setTradingPair(pair);
          this.log(`Установлена торговая пара из запроса: ${pair}`);
        } else if (!this.core.config.tradingPair) {
          // Устанавливаем пару по умолчанию из конфигурации
          const defaultPair = this.config.defaultPair || 'BTCUSDT';
          this.core.setTradingPair(defaultPair);
          this.log(`Установлена пара по умолчанию: ${defaultPair}`);
        }
        
        // Логируем обновленное состояние модуля
        this.log('Обновленный статус модуля: ' + JSON.stringify({
          isInitialized: this.isInitialized,
          hasBrowser: !!this.browser,
          tradingPair: this.core.config.tradingPair
        }));
        
        // Выполняем анализ с учетом стратегии
        const result = await this.getSignalForCurrentChart({
          strategy: req.body.strategy
        });
        
        this.log('Анализ выполнен успешно');
        res.json(result);
      } catch (error) {
        this.logError('Ошибка при анализе', error);
        res.status(500).json({ 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });
    
    // Эндпоинт для запуска автоматического анализа
    app.post('/api/modules/ai-analyzer/start-auto', async (req, res) => {
      this.log('Получен запрос на запуск автоматического анализа');
      
      try {
        const { pairs, interval, strategy, autoTrade } = req.body;
        
        if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
          return res.status(400).json({
            error: 'Необходимо указать массив торговых пар'
          });
        }
        
        if (!interval) {
          return res.status(400).json({
            error: 'Необходимо указать интервал'
          });
        }
        
        const result = this.startAutomatedAnalysis({
          pairs,
          interval,
          strategy,
          autoTrade: !!autoTrade
        });
        
        this.log('Автоматический анализ запущен');
        res.json({
          success: true,
          automation: result
        });
      } catch (error) {
        this.logError('Ошибка при запуске автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для остановки автоматического анализа
    app.post('/api/modules/ai-analyzer/stop-auto/:id', async (req, res) => {
      try {
        const id = req.params.id;
        
        if (!id) {
          return res.status(400).json({
            error: 'Необходимо указать ID задачи автоматического анализа'
          });
        }
        
        const result = this.stopAutomatedAnalysis(id);
        
        if (!result) {
          return res.status(404).json({
            error: 'Задача автоматического анализа не найдена'
          });
        }
        
        this.log(`Автоматический анализ ${id} остановлен`);
        res.json({
          success: true,
          id
        });
      } catch (error) {
        this.logError('Ошибка при остановке автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения списка задач автоматического анализа
    app.get('/api/modules/ai-analyzer/auto-tasks', (req, res) => {
      try {
        const tasks = this.getAutomatedAnalysisTasks();
        
        res.json({
          success: true,
          tasks
        });
      } catch (error) {
        this.logError('Ошибка при получении списка задач автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения метаданных модуля
    app.get('/api/modules/ai-analyzer/metadata', (req, res) => {
      try {
        res.json(this.getMetadata());
      } catch (error) {
        this.logError('Ошибка при получении метаданных', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения скриншота
    app.get('/api/modules/ai-analyzer/screenshots/:fileName', (req, res) => {
      const filePath = path.join(this.screenshotDir, req.params.fileName);
      
      fs.access(filePath)
        .then(() => {
          res.sendFile(filePath);
        })
        .catch(() => {
          res.status(404).json({ error: 'Файл не найден' });
        });
    });
    
    // Эндпоинт для получения списка активных задач анализа
    app.get('/api/modules/ai-analyzer/jobs', (req, res) => {
      try {
        const jobs = Array.from(this.activeJobs.entries()).map(([id, job]) => ({
          id,
          ...job
        }));
        
        res.json({
          success: true,
          jobs
        });
      } catch (error) {
        this.logError('Ошибка при получении списка активных задач', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для определения уровней TP/SL
    app.post('/api/modules/ai-analyzer/levels', async (req, res) => {
      try {
        const { pair, direction, entryPrice } = req.body;
        
        if (!pair || !direction || !entryPrice) {
          return res.status(400).json({
            error: 'Необходимо указать пару, направление и цену входа'
          });
        }
        
        const levels = await this.getSignalLevels(pair, direction, parseFloat(entryPrice));
        
        res.json({
          success: true,
          pair,
          direction,
          entryPrice: parseFloat(entryPrice),
          stopLoss: levels.stopLoss,
          takeProfit: levels.takeProfit
        });
      } catch (error) {
        this.logError('Ошибка при определении уровней TP/SL', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для мультитаймфрейм анализа
    app.post('/api/modules/ai-analyzer/multi-timeframe', async (req, res) => {
      try {
        const { pair, strategy, timeframes } = req.body;
        
        if (!pair) {
          return res.status(400).json({
            error: 'Необходимо указать торговую пару'
          });
        }
        
        const result = await this.analyzeMultiTimeframe(
          pair, 
          strategy || 'trend_following',
          timeframes || ['15m', '1h', '4h']
        );
        
        res.json({
          success: true,
          result
        });
      } catch (error) {
        this.logError('Ошибка при выполнении мультитаймфрейм анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
  }
  
  /**
   * Вспомогательный метод для логирования
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[AI-Analyzer] ${message}`);
    } else {
      console.log(`[AI-Analyzer] ${message}`);
    }
  }
  
  /**
   * Вспомогательный метод для логирования ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} [error] - Объект ошибки
   */
  logError(message, error) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[AI-Analyzer] ${message}`, error);
    } else {
      console.error(`[AI-Analyzer] ${message}`, error);
    }
  }
}

module.exports = AIAnalyzerModule;