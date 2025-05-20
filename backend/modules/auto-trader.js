// modules/auto-trader.js - Полноценный модуль автотрейдинга

const fs = require('fs');
const path = require('path');

class AutoTraderModule {
  constructor(config) {
    this.name = 'Автотрейдер';
    this.description = 'Модуль для автоматического исполнения торговых сигналов';
    this.config = config || {};
    this.core = null;
    this.activeSignals = [];
    this.activePositions = [];
    this.positionHistory = [];
    this.isInitialized = false;
    this.dataDir = path.join(process.cwd(), 'data');
    this.positionsFile = path.join(this.dataDir, 'positions.json');
    this.historyFile = path.join(this.dataDir, 'trade_history.json');
    this.lastCheck = 0;
    this.checkInterval = 60000; // 1 минута
    this.volatilityCache = {}; // Кэш для хранения данных о волатильности пар
  }

  // Инициализация модуля
  async initialize(core) {
    console.log('Инициализация модуля автотрейдинга...');
    this.core = core;
    
    // Проверка наличия необходимых API ключей
    const exchange = this.core.config.exchange;
    if (!this.core.config.apiKeys[exchange] || 
        !this.core.config.apiKeys[exchange].apiKey || 
        !this.core.config.apiKeys[exchange].secretKey) {
      console.warn(`Не указаны API ключи для биржи ${exchange}, торговля будет работать в режиме симуляции`);
    }
    
    // Создаем директорию для данных, если она не существует
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Загружаем сохраненные позиции и историю
    this.loadSavedData();
    
    // Регистрируем обработчики событий
    this.registerEventHandlers();
    
    // Запускаем интервал проверки позиций
    this.startPositionChecking();
    
    this.isInitialized = true;
    console.log('Модуль автотрейдинга успешно инициализирован');
    return true;
  }

  // Загрузка сохраненных данных
  loadSavedData() {
    try {
      // Загружаем активные позиции
      if (fs.existsSync(this.positionsFile)) {
        const data = fs.readFileSync(this.positionsFile, 'utf8');
        this.activePositions = JSON.parse(data);
        console.log(`Загружено ${this.activePositions.length} активных позиций`);
      }
      
      // Загружаем историю торговли
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        this.positionHistory = JSON.parse(data);
        console.log(`Загружено ${this.positionHistory.length} исторических позиций`);
      }
    } catch (error) {
      console.error('Ошибка при загрузке сохраненных данных:', error);
      // Инициализируем пустыми массивами на случай ошибки
      this.activePositions = [];
      this.positionHistory = [];
    }
  }

  // Сохранение данных в файлы
  saveData() {
    try {
      // Сохраняем активные позиции
      fs.writeFileSync(this.positionsFile, JSON.stringify(this.activePositions, null, 2));
      
      // Сохраняем историю торговли
      fs.writeFileSync(this.historyFile, JSON.stringify(this.positionHistory, null, 2));
    } catch (error) {
      console.error('Ошибка при сохранении данных:', error);
    }
  }

  // Регистрация обработчиков событий
  registerEventHandlers() {
    console.log('Регистрация обработчиков событий автотрейдинга');
    // Поскольку прямой системы событий нет, мы будем
    // полагаться на API вызовы в app.js
  }

  // Запуск проверки позиций по интервалу
  startPositionChecking() {
    // Запускаем первую проверку
    this.checkOpenPositions();
    
    // Запускаем интервал для проверки позиций
    setInterval(() => {
      this.checkOpenPositions();
    }, this.checkInterval);
  }

  // Обработка нового торгового сигнала
  async handleNewSignal(signal) {
    console.log('Получен новый торговый сигнал:', signal);
    
    // Проверяем настройки риск-менеджмента
    const riskSettings = this.config.riskManagement || this.core.config.trading || {};
    const maxConcurrentTrades = riskSettings.maxConcurrentTrades || 3;
    
    // Проверяем, не превышен ли лимит одновременных сделок
    const openPositions = this.getOpenPositions();
    if (openPositions.length >= maxConcurrentTrades) {
      console.warn('Превышен лимит одновременных сделок');
      return {
        success: false,
        error: 'Превышен лимит одновременных сделок'
      };
    }
    
    // Проверяем, нет ли уже открытой позиции по этой паре
    const existingPosition = openPositions.find(p => p.pair === signal.pair);
    if (existingPosition) {
      console.warn(`По паре ${signal.pair} уже есть открытая позиция`);
      return {
        success: false,
        error: `По паре ${signal.pair} уже есть открытая позиция`
      };
    }
    
    // Если не указаны уровни TP/SL, рассчитываем их
    if (!signal.stopLoss || !signal.takeProfit) {
      const levels = await this.getSignalLevels(signal);
      signal.stopLoss = signal.stopLoss || levels.stopLoss;
      signal.takeProfit = signal.takeProfit || levels.takeProfit;
    }
    
    // Сохраняем сигнал
    signal.timestamp = signal.timestamp || Date.now();
    this.activeSignals.push(signal);
    
    // Если включен автотрейдинг и не включен режим подтверждения вручную,
    // сразу исполняем сигнал
    if (riskSettings.autoTrading && !riskSettings.confirmationMode) {
      return await this.executeSignal(signal);
    }
    
    return {
      success: true,
      message: 'Сигнал успешно добавлен в очередь, ожидает подтверждения'
    };
  }

  // Исполнение торгового сигнала
  async executeSignal(signal) {
    console.log('Исполнение торгового сигнала:', signal);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Рассчитываем размер позиции
      const positionSize = this.calculatePositionSize(signal);
      
      // Создаем уникальный идентификатор для позиции
      const positionId = `${signal.pair}_${signal.direction}_${Date.now()}`;
      
      // Создаем объект позиции
      const position = {
        id: positionId,
        pair: signal.pair,
        direction: signal.direction,
        entryPoint: signal.entryPoint,
        currentPrice: signal.entryPoint,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        size: positionSize,
        status: 'PENDING',
        openTime: Date.now(),
        closeTime: null,
        profit: 0,
        profitPercent: 0,
        closeReason: null,
        orderId: null
      };
      
      // Пытаемся создать ордер на бирже
      try {
        // Проверяем режим работы (реальный или симуляция)
        if (this.config.simulationMode || !exchange.apiKey) {
          console.log('Работа в режиме симуляции, ордер не отправляется на биржу');
          position.status = 'OPEN';
          position.simulationMode = true;
        } else {
          // Создаем ордер на бирже
          const order = await exchange.createOrder(
            signal.pair,
            signal.direction,
            'LIMIT',
            positionSize,
            signal.entryPoint
          );
          position.orderId = order.orderId;
          position.status = 'OPEN';
        }
      } catch (orderError) {
        console.error('Ошибка при создании ордера:', orderError);
        position.status = 'ERROR';
        position.error = orderError.message;
      }
      
      // Добавляем позицию в список активных
      this.activePositions.push(position);
      
      // Сохраняем данные
      this.saveData();
      
      console.log('Сигнал успешно исполнен, создана позиция:', positionId);
      
      return {
        success: true,
        positionId: positionId,
        position: position
      };
    } catch (error) {
      console.error('Ошибка при исполнении сигнала:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Расчет размера позиции
  calculatePositionSize(signal) {
    // Получаем настройки риск-менеджмента
    const riskSettings = this.config.riskManagement || this.core.config.trading || {};
    const maxRiskPercent = riskSettings.maxRiskPercent || 1; // % от депозита на сделку
    
    // Получаем информацию о депозите (заглушка)
    const deposit = this.getDepositInfo();
    
    // Рассчитываем риск на сделку в абсолютном выражении
    const riskAmount = deposit.total * (maxRiskPercent / 100);
    
    // Рассчитываем максимальный убыток в % от цены входа до стоп-лосса
    const entryPrice = signal.entryPoint;
    const stopLossPrice = signal.stopLoss;
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice) / entryPrice * 100;
    
    // Рассчитываем размер позиции
    let positionSize = riskAmount / (entryPrice * riskPerUnit / 100);
    
    // Если включен разгон депозита, учитываем серию успешных сделок
    if (riskSettings.depositAcceleration) {
      const successStreak = this.calculateSuccessStreak();
      // Увеличиваем размер позиции на 10% за каждую успешную сделку подряд,
      // но не более чем в 3 раза от базового размера
      const accelerationFactor = Math.min(1 + (successStreak * 0.1), 3);
      positionSize *= accelerationFactor;
    }
    
    // Округляем до 4 знаков после запятой
    positionSize = Math.round(positionSize * 10000) / 10000;
    
    console.log(`Расчет размера позиции: депозит=${deposit.total}, риск=${maxRiskPercent}%, размер=${positionSize}`);
    
    return positionSize;
  }

  // Получение информации о депозите (заглушка)
  getDepositInfo() {
    // В реальном модуле здесь будет запрос к бирже
    
    // Для примера используем фиксированные значения
    return {
      total: 1000, // Общий размер депозита в USD
      available: 900, // Доступно для торговли
      margin: 100 // Занято в открытых позициях
    };
  }

  // Расчет количества успешных сделок подряд
  calculateSuccessStreak() {
    if (this.positionHistory.length === 0) {
      return 0;
    }
    
    // Сортируем историю по времени закрытия (от новых к старым)
    const sortedHistory = [...this.positionHistory]
      .sort((a, b) => b.closeTime - a.closeTime);
    
    // Считаем количество успешных сделок подряд
    let streak = 0;
    for (const position of sortedHistory) {
      if (position.profit > 0) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  // Проверка и обновление статуса открытых позиций
 async checkOpenPositions() {
  const openPositions = this.getOpenPositions();
  if (openPositions.length === 0) {
    return;
  }
  
  console.log(`Проверка открытых позиций: ${openPositions.length}`);
  const now = Date.now();
  
  // Чтобы не отправлять слишком много запросов, делаем проверку не чаще чем раз в минуту
  if (now - this.lastCheck < this.checkInterval) {
    return;
  }
  
  this.lastCheck = now;
  
  // Получаем активный коннектор к бирже
  const exchange = this.core.getActiveExchangeConnector();
  
  // Проверяем каждую открытую позицию
  for (const position of openPositions) {
    try {
      // Проверяем, что позиция имеет поле pair
      if (!position.pair) {
        console.warn(`Позиция ${position.id} не содержит информации о торговой паре, пропускаем проверку`);
        continue;
      }
      
      // Получаем текущую цену для пары
      let currentPrice;
      
      if (position.simulationMode) {
        // В режиме симуляции генерируем случайную цену
        const randomMove = (Math.random() - 0.5) * 0.01; // -0.5% до +0.5%
        currentPrice = position.currentPrice * (1 + randomMove);
      } else {
        try {
          // Получаем реальную цену с биржи
          const ticker = await exchange.getTicker(position.pair);
          currentPrice = parseFloat(ticker.lastPrice);
        } catch (tickerError) {
          console.error(`Ошибка получения актуальной цены для пары ${position.pair}: ${tickerError.message}`);
          // Используем последнюю известную цену, чтобы не блокировать проверку
          currentPrice = position.currentPrice;
        }
      }
      
      // Обновляем текущую цену в позиции
      position.currentPrice = currentPrice;
      
      // Рассчитываем текущую прибыль/убыток
      this.calculatePositionProfitLoss(position);
      
      // Проверяем, достигнут ли стоп-лосс или тейк-профит
      if (this.shouldClosePosition(position)) {
        await this.closePosition(position.id, 'TP/SL');
      }
    } catch (error) {
      console.error(`Ошибка при проверке позиции ${position.id}:`, error);
    }
  }
  
  // Сохраняем обновленные данные
  this.saveData();
}
    
    

  // Расчет прибыли/убытка позиции
  calculatePositionProfitLoss(position) {
    const entryPrice = position.entryPoint;
    const currentPrice = position.currentPrice;
    
    let profitPercent;
    if (position.direction === 'BUY') {
      profitPercent = (currentPrice - entryPrice) / entryPrice * 100;
    } else {
      profitPercent = (entryPrice - currentPrice) / entryPrice * 100;
    }
    
    // Абсолютная прибыль/убыток
    const profit = position.size * entryPrice * (profitPercent / 100);
    
    // Обновляем данные позиции
    position.profit = Math.round(profit * 100) / 100; // Округляем до 2 знаков
    position.profitPercent = Math.round(profitPercent * 100) / 100; // Округляем до 2 знаков
    
    return {
      profit,
      profitPercent
    };
  }

  // Проверка, нужно ли закрыть позицию по TP/SL
  shouldClosePosition(position) {
    const currentPrice = position.currentPrice;
    
    // Проверяем стоп-лосс
    if (position.direction === 'BUY' && currentPrice <= position.stopLoss) {
      console.log(`Позиция ${position.id} достигла стоп-лосса`);
      return true;
    }
    
    if (position.direction === 'SELL' && currentPrice >= position.stopLoss) {
      console.log(`Позиция ${position.id} достигла стоп-лосса`);
      return true;
    }
    
    // Проверяем тейк-профит
    if (position.direction === 'BUY' && currentPrice >= position.takeProfit) {
      console.log(`Позиция ${position.id} достигла тейк-профита`);
      return true;
    }
    
    if (position.direction === 'SELL' && currentPrice <= position.takeProfit) {
      console.log(`Позиция ${position.id} достигла тейк-профита`);
      return true;
    }
    
    return false;
  }

  // Закрытие позиции
  async closePosition(positionId, reason) {
    const position = this.activePositions.find(p => p.id === positionId);
    if (!position) {
      console.warn(`Позиция ${positionId} не найдена`);
      return {
        success: false,
        error: 'Позиция не найдена'
      };
    }
    
    console.log(`Закрытие позиции ${positionId} по причине: ${reason}`);
    
    try {
      // Если не в режиме симуляции и есть orderId, закрываем на бирже
      if (!position.simulationMode && position.orderId) {
        // Получаем активный коннектор к бирже
        const exchange = this.core.getActiveExchangeConnector();
        
        // Создаем ордер закрытия
        await exchange.createOrder(
          position.pair,
          position.direction === 'BUY' ? 'SELL' : 'BUY',
          'MARKET',
          position.size
        );
      }
      
      // Обновляем статус позиции
      position.status = 'CLOSED';
      position.closeTime = Date.now();
      position.closeReason = reason;
      
      // Рассчитываем финальную прибыль/убыток
      this.calculatePositionProfitLoss(position);
      
      // Перемещаем позицию из активных в историю
      this.activePositions = this.activePositions.filter(p => p.id !== positionId);
      this.positionHistory.push(position);
      
      // Сохраняем данные
      this.saveData();
      
      console.log(`Позиция ${positionId} успешно закрыта с P/L ${position.profit} (${position.profitPercent}%)`);
      
      return {
        success: true,
        position: position
      };
    } catch (error) {
      console.error(`Ошибка при закрытии позиции ${positionId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение открытых позиций
  getOpenPositions() {
    return this.activePositions.filter(p => p.status === 'OPEN' || p.status === 'PENDING');
  }

  // Получение истории позиций
  getPositionHistory() {
    return this.positionHistory;
  }

  // Получение статистики торговли
  getTradingStats() {
    // Собираем всю историю (закрытые позиции)
    const history = this.positionHistory;
    
    // Если история пуста, возвращаем пустую статистику
    if (history.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        totalProfit: 0,
        maxProfit: 0,
        maxLoss: 0,
        profitFactor: 0,
        successStreak: 0,
        currentStreak: 0
      };
    }
    
    // Подсчитываем базовую статистику
    const totalTrades = history.length;
    const profitableTrades = history.filter(p => p.profit > 0).length;
    const winRate = (profitableTrades / totalTrades) * 100;
    
    // Общая прибыль/убыток
    const totalProfit = history.reduce((sum, p) => sum + p.profit, 0);
    const avgProfit = totalProfit / totalTrades;
    
    // Максимальная прибыль и убыток
    const maxProfit = Math.max(...history.map(p => p.profit));
    const maxLoss = Math.min(...history.map(p => p.profit));
    
    // Profit factor (отношение общей прибыли к общему убытку)
    const totalGain = history.filter(p => p.profit > 0).reduce((sum, p) => sum + p.profit, 0);
    const totalLoss = Math.abs(history.filter(p => p.profit < 0).reduce((sum, p) => sum + p.profit, 0));
    const profitFactor = totalLoss !== 0 ? totalGain / totalLoss : totalGain;
    
    // Текущая серия успешных/неуспешных сделок
    const sortedHistory = [...history].sort((a, b) => b.closeTime - a.closeTime);
    let currentStreak = 0;
    const lastResult = sortedHistory[0]?.profit > 0;
    
    for (const position of sortedHistory) {
      if ((position.profit > 0) === lastResult) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Если последняя сделка убыточная, делаем стрик отрицательным
    if (!lastResult) {
      currentStreak = -currentStreak;
    }
    
    // Максимальная серия успешных сделок
    const successStreak = this.calculateSuccessStreak();
    
    return {
      totalTrades,
      winRate: Math.round(winRate * 100) / 100,
      avgProfit: Math.round(avgProfit * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      successStreak,
      currentStreak
    };
  }

  // Очистка ресурсов при выгрузке модуля
  async cleanup() {
    console.log('Очистка ресурсов модуля автотрейдинга...');
    
    // Сохраняем текущее состояние
    this.saveData();
    
    this.isInitialized = false;
    console.log('Модуль автотрейдинга успешно выгружен');
  }

  // Предоставление метаданных модуля для API
  getMetadata() {
    return {
      id: 'auto-trader',
      name: this.name,
      description: this.description,
      version: '1.0.0',
      capabilities: [
        'execute_signals',
        'manage_positions',
        'risk_management',
        'trading_statistics'
      ]
    };
  }

  // Добавление эндпоинтов в Express приложение
  registerApiEndpoints(app) {
    // Эндпоинт для исполнения сигнала
    app.post('/api/execute-signal', async (req, res) => {
      try {
        const signal = req.body;
        const result = await this.executeSignal(signal);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Эндпоинт для получения открытых позиций
    app.get('/api/positions', (req, res) => {
      res.json({
        openPositions: this.getOpenPositions(),
        history: this.getPositionHistory()
      });
    });
    
    // Эндпоинт для получения статистики торговли
    app.get('/api/trading-stats', (req, res) => {
      res.json(this.getTradingStats());
    });
    
    // Эндпоинт для закрытия позиции
    app.post('/api/close-position/:id', async (req, res) => {
      try {
        const positionId = req.params.id;
        const reason = req.body.reason || 'MANUAL';
        
        const result = await this.closePosition(positionId, reason);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // НОВЫЕ МЕТОДЫ

  // Метод для определения уровней TP/SL для сигнала
  async getSignalLevels(signal) {
    console.log(`Определение уровней TP/SL для сигнала ${signal.pair}`);
    
    try {
      const riskSettings = this.config.riskManagement || this.core.config.trading || {};
      
      // Способ расчета уровней (по AI или TA)
      const levelsMethod = riskSettings.levelsMethod || 'TA';
      
      let levels = {
        stopLoss: null,
        takeProfit: null
      };
      
      if (levelsMethod === 'AI' && this.core.aiAnalyzer) {
        // Получаем результаты AI анализа
        const aiAnalysis = await this.core.aiAnalyzer.analyzeChart(signal.pair, signal.timeframe);
        
        // Извлекаем уровни из анализа AI
        levels = this._extractLevelsFromAnalysis(aiAnalysis, signal);
      } else {
        // Рассчитываем уровни на основе технического анализа
        levels = await this._calculateLevelsByTA(signal);
      }
      
      // Если не удалось получить уровни, используем фиксированные значения
      if (!levels.stopLoss || !levels.takeProfit) {
        const defaultRiskReward = riskSettings.riskRewardRatio || 2;
        const defaultStopPercent = riskSettings.defaultStopLossPercent || 1;
        
        const entryPrice = signal.entryPoint;
        
        // Рассчитываем стоп-лосс на основе defaultStopPercent
        const stopLossPercent = defaultStopPercent / 100;
        
        if (signal.direction === 'BUY') {
          levels.stopLoss = levels.stopLoss || entryPrice * (1 - stopLossPercent);
          levels.takeProfit = levels.takeProfit || entryPrice * (1 + stopLossPercent * defaultRiskReward);
        } else {
          levels.stopLoss = levels.stopLoss || entryPrice * (1 + stopLossPercent);
          levels.takeProfit = levels.takeProfit || entryPrice * (1 - stopLossPercent * defaultRiskReward);
        }
      }
      
      // Округляем значения до соответствующей точности
      const precision = this._getPricePrecision(signal.pair);
      levels.stopLoss = parseFloat(levels.stopLoss.toFixed(precision));
      levels.takeProfit = parseFloat(levels.takeProfit.toFixed(precision));
      
      console.log(`Определены уровни для ${signal.pair}: SL=${levels.stopLoss}, TP=${levels.takeProfit}`);
      
      return levels;
    } catch (error) {
      console.error(`Ошибка при определении уровней для ${signal.pair}:`, error);
      
      // В случае ошибки возвращаем null
      return {
        stopLoss: null,
        takeProfit: null
      };
    }
  }

  // Улучшенный метод для извлечения уровней TP/SL из результата анализа AI
  _extractLevelsFromAnalysis(analysis, signal) {
    try {
      console.log('Извлечение уровней из AI анализа');
      
      // Если анализ не содержит данных, возвращаем пустой объект
      if (!analysis || !analysis.result) {
        return { stopLoss: null, takeProfit: null };
      }
      
      const result = analysis.result;
      const direction = signal.direction;
      const entryPrice = signal.entryPoint;
      
      let stopLoss = null;
      let takeProfit = null;
      
      // Проверяем наличие явных рекомендаций по уровням в результате анализа
      if (result.levels && result.levels[direction]) {
        const levels = result.levels[direction];
        stopLoss = levels.stopLoss || null;
        takeProfit = levels.takeProfit || null;
      } 
      // Проверяем наличие уровней поддержки и сопротивления
      else if (result.supportLevels && result.supportLevels.length > 0 && 
               result.resistanceLevels && result.resistanceLevels.length > 0) {
        
        // Сортируем уровни
        const supportLevels = [...result.supportLevels].sort((a, b) => b - a);
        const resistanceLevels = [...result.resistanceLevels].sort((a, b) => a - b);
        
        if (direction === 'BUY') {
          // Для покупки: ближайший уровень поддержки ниже - стоп, ближайший уровень сопротивления выше - тейк
          stopLoss = supportLevels.find(level => level < entryPrice);
          takeProfit = resistanceLevels.find(level => level > entryPrice);
        } else {
          // Для продажи: ближайший уровень сопротивления выше - стоп, ближайший уровень поддержки ниже - тейк
          stopLoss = resistanceLevels.find(level => level > entryPrice);
          takeProfit = supportLevels.find(level => level < entryPrice);
        }
      }
      
      // Если не нашли явные уровни, но есть рекомендуемый риск/награда
      if ((!stopLoss || !takeProfit) && result.riskRewardRatio) {
        const riskRewardRatio = parseFloat(result.riskRewardRatio);
        
        // Если указан явно только один из уровней, вычисляем второй
        if (stopLoss && !takeProfit) {
          const riskAmount = Math.abs(entryPrice - stopLoss);
          if (direction === 'BUY') {
            takeProfit = entryPrice + (riskAmount * riskRewardRatio);
          } else {
            takeProfit = entryPrice - (riskAmount * riskRewardRatio);
          }
        } else if (!stopLoss && takeProfit) {
          const rewardAmount = Math.abs(entryPrice - takeProfit);
          if (direction === 'BUY') {
            stopLoss = entryPrice - (rewardAmount / riskRewardRatio);
          } else {
            stopLoss = entryPrice + (rewardAmount / riskRewardRatio);
          }
        }
      }
      
      // Проверяем на тренд, если уровни все еще не определены
      if ((!stopLoss || !takeProfit) && result.trendStrength && result.trendDirection) {
        const trendStrength = parseFloat(result.trendStrength);
        const volatility = this._getVolatility(signal.pair, signal.timeframe) || 0.01;
        
        // Используем силу тренда и волатильность для расчета уровней
        if (direction === 'BUY') {
          stopLoss = stopLoss || entryPrice * (1 - volatility);
          takeProfit = takeProfit || entryPrice * (1 + volatility * (1 + trendStrength));
        } else {
          stopLoss = stopLoss || entryPrice * (1 + volatility);
          takeProfit = takeProfit || entryPrice * (1 - volatility * (1 + trendStrength));
        }
      }
      
      // Проверяем обоснованность полученных уровней
      if (stopLoss && takeProfit) {
        const riskRewardRatio = direction === 'BUY' 
          ? (takeProfit - entryPrice) / (entryPrice - stopLoss) 
          : (entryPrice - takeProfit) / (stopLoss - entryPrice);
        
        console.log(`Рассчитанное соотношение риск/награда: ${riskRewardRatio.toFixed(2)}`);
        
        // Если соотношение слишком маленькое, корректируем
        if (riskRewardRatio < 1) {
          console.log('Корректировка уровней из-за низкого соотношения риск/награда');
          if (direction === 'BUY') {
            takeProfit = entryPrice + (entryPrice - stopLoss) * 2;
          } else {
            takeProfit = entryPrice - (stopLoss - entryPrice) * 2;
          }
        }
      }
      
      return { stopLoss, takeProfit };
    } catch (error) {
      console.error('Ошибка при извлечении уровней из AI анализа:', error);
      return { stopLoss: null, takeProfit: null };
    }
  }

  // Улучшенный метод для расчета уровней на основе технического анализа
  async _calculateLevelsByTA(signal) {
    try {
      console.log(`Расчет уровней TP/SL на основе ТА для ${signal.pair}`);
      
      const exchange = this.core.getActiveExchangeConnector();
      const pair = signal.pair;
      const timeframe = signal.timeframe || '1h';
      const direction = signal.direction;
      const entryPrice = signal.entryPoint;
      
      // Получаем исторические данные
      const candles = await exchange.getCandles(pair, timeframe, 100);
      if (!candles || candles.length < 30) {
        throw new Error('Недостаточно исторических данных');
      }
      
      // Рассчитываем волатильность (ATR)
      const atr = this._calculateATR(candles, 14);
      
      // Кэшируем волатильность для быстрого доступа в будущем
      this.volatilityCache[`${pair}_${timeframe}`] = {
        atr,
        timestamp: Date.now()
      };
      
      // Находим ключевые уровни поддержки и сопротивления
      const levels = this._findKeyLevels(candles);
      
      // Определяем ближайшие уровни для стоп-лосса и тейк-профита
      let stopLoss, takeProfit;
      
      if (direction === 'BUY') {
        // Для покупки: ближайший уровень поддержки ниже - стоп
        stopLoss = Math.max(
          entryPrice - (atr * 1.5), // Стоп на расстоянии 1.5 ATR
          levels.support.find(level => level < entryPrice) || // или ближайший уровень поддержки
          entryPrice * 0.98 // или 2% от цены входа
        );
        
        // Ближайший уровень сопротивления выше - тейк
        takeProfit = Math.min(
          entryPrice + (atr * 3), // Тейк на расстоянии 3 ATR
          levels.resistance.find(level => level > entryPrice) || // или ближайший уровень сопротивления
          entryPrice * 1.05 // или 5% от цены входа
        );
      } else {
        // Для продажи: ближайший уровень сопротивления выше - стоп
        stopLoss = Math.min(
          entryPrice + (atr * 1.5), // Стоп на расстоянии 1.5 ATR
          levels.resistance.find(level => level > entryPrice) || // или ближайший уровень сопротивления
          entryPrice * 1.02 // или 2% от цены входа
        );
        
        // Ближайший уровень поддержки ниже - тейк
        takeProfit = Math.max(
          entryPrice - (atr * 3), // Тейк на расстоянии 3 ATR
          levels.support.find(level => level < entryPrice) || // или ближайший уровень поддержки
          entryPrice * 0.95 // или 5% от цены входа
        );
      }
      
      // Проверяем соотношение риск/награда
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(entryPrice - takeProfit);
      const riskRewardRatio = reward / risk;
      
      // Если соотношение слишком маленькое, корректируем тейк-профит
      if (riskRewardRatio < 1.5) {
        console.log(`Корректировка тейк-профита из-за низкого RR (${riskRewardRatio.toFixed(2)})`);
        if (direction === 'BUY') {
          takeProfit = entryPrice + (risk * 2);
        } else {
          takeProfit = entryPrice - (risk * 2);
        }
      }
      
      console.log(`Рассчитаны уровни для ${pair}: SL=${stopLoss}, TP=${takeProfit}, RR=${reward/risk}`);
      
      return { 
        stopLoss, 
        takeProfit 
      };
    } catch (error) {
      console.error(`Ошибка при расчете уровней по ТА для ${signal.pair}:`, error);
      return { stopLoss: null, takeProfit: null };
    }
  }

  // Метод для анализа нескольких таймфреймов
  async analyzeMultiTimeframe(pair, direction) {
    console.log(`Анализ нескольких таймфреймов для ${pair}, направление: ${direction}`);
    
    try {
      // Список таймфреймов для анализа (от меньшего к большему)
      const timeframes = ['15m', '1h', '4h', '1d'];
      const results = [];
      
      const exchange = this.core.getActiveExchangeConnector();
      const aiAnalyzer = this.core.aiAnalyzer;
      
      // Получаем текущую цену
      const ticker = await exchange.getTicker(pair);
      const currentPrice = parseFloat(ticker.lastPrice);
      
      // Анализируем каждый таймфрейм
      for (const timeframe of timeframes) {
        console.log(`Анализ таймфрейма ${timeframe} для ${pair}`);
        
        // Получаем исторические данные
        const candles = await exchange.getCandles(pair, timeframe, 50);
        
        // Рассчитываем индикаторы
        const rsi = this._calculateRSI(candles, 14);
        const ema20 = this._calculateEMA(candles.map(c => c.close), 20);
        const ema50 = this._calculateEMA(candles.map(c => c.close), 50);
        
        // Оценка тренда
        let trendScore = 0;
        
        // Проверка по EMA
        if (ema20[ema20.length - 1] > ema50[ema50.length - 1]) {
          trendScore += 1; // Восходящий тренд
        } else {
          trendScore -= 1; // Нисходящий тренд
        }
        
        // Проверка по RSI
        if (rsi > 50) {
          trendScore += 0.5; // Бычий импульс
        } else if (rsi < 50) {
          trendScore -= 0.5; // Медвежий импульс
        }
        
        // Для дневного таймфрейма вес в 2 раза больше
        if (timeframe === '1d') {
          trendScore *= 2;
        } else if (timeframe === '4h') {
          trendScore *= 1.5;
        }
        
        // Если есть AI-анализатор, дополняем его оценкой
        if (aiAnalyzer) {
          try {
            const aiResult = await aiAnalyzer.analyzeChart(pair, timeframe);
            if (aiResult && aiResult.result && aiResult.result.trendDirection) {
              // Добавляем оценку от AI (от -1 до 1)
              const aiTrendScore = aiResult.result.trendDirection === 'UP' ? 1 : -1;
              trendScore += aiTrendScore * (timeframe === '1d' ? 2 : 1);
            }
          } catch (aiError) {
            console.warn(`Ошибка AI-анализа для ${pair} (${timeframe}):`, aiError);
          }
        }
        
        results.push({
          timeframe,
          trendScore,
          rsi,
          priceRelativeToEMA: currentPrice / ema20[ema20.length - 1] - 1
        });
      }
      
      // Общая оценка на основе всех таймфреймов
      const totalScore = results.reduce((sum, result) => sum + result.trendScore, 0);
      
      // Определяем консенсусный сигнал
      const consensusSignal = this._determineConsensusSignal(results, direction);
      
      return {
        pair,
        currentPrice,
        timeframeAnalysis: results,
        totalScore,
        consensusSignal,
        recommendation: consensusSignal.signalStrength > 0 ? 'ENTER' : 'WAIT'
      };
    } catch (error) {
      console.error(`Ошибка при мультитаймфреймовом анализе для ${pair}:`, error);
      return { 
        pair, 
        error: error.message,
        recommendation: 'ERROR' 
      };
    }
  }

  // Вспомогательный метод для определения консенсусного сигнала
  _determineConsensusSignal(results, requestedDirection) {
    // Вес для каждого таймфрейма (чем выше таймфрейм, тем больше вес)
    const timeframeWeights = {
      '15m': 0.5,
      '1h': 1,
      '4h': 2,
      '1d': 3
    };
    
    let totalWeight = 0;
    let weightedScoreSum = 0;
    
    // Рассчитываем взвешенную сумму оценок
    for (const result of results) {
      const weight = timeframeWeights[result.timeframe] || 1;
      weightedScoreSum += result.trendScore * weight;
      totalWeight += weight;
    }
    
    // Нормализуем значение от -1 до 1
    const normalizedScore = totalWeight > 0 ? 
      weightedScoreSum / totalWeight : 0;
    
    // Определяем силу сигнала от 0 до 100
    const signalStrength = Math.min(100, Math.abs(normalizedScore) * 100);
    
    // Определяем направление сигнала
    let signalDirection;
    if (normalizedScore > 0.2) {
      signalDirection = 'BUY';
    } else if (normalizedScore < -0.2) {
      signalDirection = 'SELL';
    } else {
      signalDirection = 'NEUTRAL';
    }
    
    // Проверяем совпадение с запрошенным направлением
    const directionMatch = signalDirection === requestedDirection;
    
    // Рассчитываем перекупленность/перепроданность
    const isOverbought = results.some(r => r.rsi > 70);
    const isOversold = results.some(r => r.rsi < 30);
    
    return {
      signalDirection,
      signalStrength: directionMatch ? signalStrength : -signalStrength,
      normalizedScore,
      directionMatch,
      isOverbought,
      isOversold,
      // Если направление совпадает, но есть противоречия в таймфреймах
      conflictingTimeframes: results.filter(r => 
        (signalDirection === 'BUY' && r.trendScore < 0) ||
        (signalDirection === 'SELL' && r.trendScore > 0)
      ).map(r => r.timeframe)
    };
  }

  // Вспомогательные методы для технического анализа

  // Расчет ATR (Average True Range)
  _calculateATR(candles, period) {
    if (candles.length < period + 1) {
      return null;
    }
    
    const trueRanges = [];
    
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i-1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    // Расчет среднего за период
    let atr = 0;
    if (trueRanges.length >= period) {
      const lastValues = trueRanges.slice(-period);
      atr = lastValues.reduce((sum, val) => sum + val, 0) / period;
    }
    
    return atr;
  }

  // Поиск ключевых уровней поддержки и сопротивления
  _findKeyLevels(candles) {
    const support = [];
    const resistance = [];
    
    // Находим локальные минимумы и максимумы
    for (let i = 2; i < candles.length - 2; i++) {
      // Локальный минимум (поддержка)
      if (candles[i].low < candles[i-1].low && 
          candles[i].low < candles[i-2].low && 
          candles[i].low < candles[i+1].low && 
          candles[i].low < candles[i+2].low) {
        support.push(candles[i].low);
      }
      
      // Локальный максимум (сопротивление)
      if (candles[i].high > candles[i-1].high && 
          candles[i].high > candles[i-2].high && 
          candles[i].high > candles[i+1].high && 
          candles[i].high > candles[i+2].high) {
        resistance.push(candles[i].high);
      }
    }
    
    // Группируем близкие уровни
    const groupedSupport = this._groupSimilarLevels(support);
    const groupedResistance = this._groupSimilarLevels(resistance);
    
    return {
      support: groupedSupport,
      resistance: groupedResistance
    };
  }

  // Группировка похожих уровней
  _groupSimilarLevels(levels) {
    if (levels.length === 0) return [];
    
    // Сортируем уровни
    const sortedLevels = [...levels].sort((a, b) => a - b);
    
    // Группируем близкие уровни (в пределах 0.5%)
    const groupedLevels = [];
    let currentGroup = [sortedLevels[0]];
    
    for (let i = 1; i < sortedLevels.length; i++) {
      const currentLevel = sortedLevels[i];
      const previousLevel = sortedLevels[i-1];
      
      // Если текущий уровень близок к предыдущему, добавляем в текущую группу
      if ((currentLevel - previousLevel) / previousLevel < 0.005) {
        currentGroup.push(currentLevel);
      } else {
        // Иначе завершаем текущую группу и начинаем новую
        groupedLevels.push(this._averageLevel(currentGroup));
        currentGroup = [currentLevel];
      }
    }
    
    // Добавляем последнюю группу
    if (currentGroup.length > 0) {
      groupedLevels.push(this._averageLevel(currentGroup));
    }
    
    return groupedLevels;
  }

  // Расчет среднего значения уровня
  _averageLevel(levels) {
    return levels.reduce((sum, level) => sum + level, 0) / levels.length;
  }

  // Получение волатильности для пары и таймфрейма
  _getVolatility(pair, timeframe) {
    const cacheKey = `${pair}_${timeframe}`;
    
    // Проверяем кэш волатильности
    if (this.volatilityCache[cacheKey] && 
        Date.now() - this.volatilityCache[cacheKey].timestamp < 3600000) { // Кэш на 1 час
      return this.volatilityCache[cacheKey].atr;
    }
    
    // Если нет в кэше, возвращаем стандартное значение
    return null;
  }

  // Расчет RSI (Relative Strength Index)
  _calculateRSI(candles, period) {
    if (candles.length < period + 1) {
      return 50; // Нейтральное значение по умолчанию
    }
    
    const closes = candles.map(c => c.close);
    let gains = 0;
    let losses = 0;
    
    // Рассчитываем начальное среднее изменений
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i-1];
      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    gains /= period;
    losses /= period;
    
    // Продолжаем вычисление для оставшихся свечей
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i-1];
      
      if (change >= 0) {
        gains = (gains * (period - 1) + change) / period;
        losses = (losses * (period - 1)) / period;
      } else {
        gains = (gains * (period - 1)) / period;
        losses = (losses * (period - 1) - change) / period;
      }
    }
    
    // Расчет RSI
    const rs = gains / losses;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  // Расчет EMA (Exponential Moving Average)
  _calculateEMA(values, period) {
    const k = 2 / (period + 1);
    
    // Начальное значение - простое среднее за период
    const initialSMA = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    
    const ema = [initialSMA];
    
    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i-1] * (1 - k));
    }
    
    return ema;
  }

  // Получение точности для округления цены
  _getPricePrecision(pair) {
    // Заглушка - в реальном приложении это должна быть таблица с
    // точностью для каждой пары с биржи
    const defaultPrecision = 2;
    
    // Особенные случаи
    if (pair.includes('BTC') || pair.includes('ETH')) {
      return 5; // Высокая точность для BTC и ETH пар
    } else if (pair.includes('USD')) {
      return 2; // Стандартная для USD пар
    }
    
    return defaultPrecision;
  }
}

module.exports = AutoTraderModule;