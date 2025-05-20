// modules/adaptive-smart-grid.js
// Модуль Adaptive Smart Grid для автоматического размещения ордеров с адаптивными параметрами

const fs = require('fs').promises;
const path = require('path');

/**
 * Модуль Adaptive Smart Grid (ASG)
 * Реализует динамическую сетку ордеров с адаптивными параметрами на основе рыночных условий
 */
class AdaptiveSmartGrid {
  /**
   * Создает новый экземпляр модуля Adaptive Smart Grid
   * @param {Object} config - Конфигурация модуля
   */
  constructor(config) {
    // Метаданные модуля
    this.name = 'Adaptive Smart Grid';
    this.description = 'Динамическая сетка ордеров с адаптивными параметрами на основе рыночных условий';
    this.id = 'adaptive-smart-grid';
    this.version = '1.1.0'; // Увеличена версия
    
    // Конфигурация
    this.config = this._initConfig(config || {});
    
    // Состояние модуля
    this.core = null;
    this.isInitialized = false;
    
    // Активные сетки ордеров
    this.activeGrids = new Map();
    
    // История сеток
    this.gridHistory = [];
    
    // Директория для данных
    this.dataDir = path.join(process.cwd(), 'data');
    this.gridsFile = path.join(this.dataDir, 'asg_grids.json');
    this.historyFile = path.join(this.dataDir, 'asg_history.json');
    this.statsFile = path.join(this.dataDir, 'asg_stats.json'); // Добавлен файл для статистики
    
    // Обработчики событий
    this.eventHandlers = {};
    
    // Таймеры для проверки состояний сеток
    this.checkInterval = null;
    
    // Кэш для оптимизации расчетов
    this.calculationCache = {
      atr: new Map(),
      ema: new Map(),
      chartData: new Map(),
      balance: { timestamp: 0, data: null }
    };
    
    // Статистика модуля
    this.moduleStats = {
      totalGridsCreated: 0,
      totalGridsCompleted: 0,
      totalProfit: 0,
      successfulGrids: 0,
      avgCompletionTime: 0,
      lastUpdate: Date.now()
    };
    
    // Состояние рынка для анализа
    this.marketState = {
      volatilityLevel: 'MEDIUM',
      marketTrend: 'NEUTRAL',
      lastUpdate: 0
    };
  }

  /**
   * Инициализирует конфигурацию по умолчанию
   * @param {Object} config - Конфигурация из конструктора
   * @returns {Object} - Инициализированная конфигурация
   * @private
   */
  _initConfig(config) {
    return {
      // Параметры сетки
      maxGridSize: config.maxGridSize || 10, // Максимальное количество ордеров в сетке
      gridSpacingATRMultiplier: config.gridSpacingATRMultiplier || 0.5, // Множитель ATR для расстояния между ордерами
      defaultLotSize: config.defaultLotSize || 0.01, // Размер позиции по умолчанию
      scalingFactor: config.scalingFactor || 1.2, // Коэффициент увеличения размера позиции (если используется)
      defaultGridLevels: config.defaultGridLevels || 5, // Базовое количество уровней сетки
      
      // Параметры входа/выхода
      takeProfitFactor: config.takeProfitFactor || 1.5, // Множитель для вычисления тейк-профита
      stopLossFactor: config.stopLossFactor || 2.0, // Множитель для вычисления стоп-лосса
      trailingStopEnabled: config.trailingStopEnabled !== false, // Использовать ли трейлинг-стоп
      trailingStopActivationPercent: config.trailingStopActivationPercent || 0.5, // Активация трейлинг-стопа (% от TP)
      
      // Анализ рынка
      atrPeriod: config.atrPeriod || 14, // Период для расчета ATR
      emaFastPeriod: config.emaFastPeriod || 50, // Период для быстрой EMA
      emaSlowPeriod: config.emaSlowPeriod || 200, // Период для медленной EMA
      
      // Фильтры
      volumeThreshold: config.volumeThreshold || 1.5, // Порог объема для фильтрации (от среднего)
      minimumSignalConfidence: config.minimumSignalConfidence || 0.7, // Минимальная уверенность сигнала
      
      // Управление рисками
      maxRiskPerTrade: config.maxRiskPerTrade || 1.0, // Максимальный риск на сделку (% от баланса)
      maxDrawdownPercent: config.maxDrawdownPercent || 10.0, // Максимальная просадка, при которой сетка закрывается
      maxConcurrentGrids: config.maxConcurrentGrids || 3, // Максимальное количество одновременных сеток
      initialCapital: config.initialCapital || 1000, // Начальный капитал
      minInvestmentPerLevel: config.minInvestmentPerLevel || 10, // Минимальный объем инвестиций на один уровень
      maxBalancePerGrid: config.maxBalancePerGrid || 0.25, // Максимальная доля баланса на одну сетку
      minPositionSize: config.minPositionSize || 0.001, // Минимальный размер позиции
      targetProfitPercent: config.targetProfitPercent || 5.0, // Целевой процент прибыли для закрытия всей сетки
      
      // Интервалы проверки и обновления
      statusCheckInterval: config.statusCheckInterval || 60000, // Интервал проверки статуса сеток (мс)
      dataCacheLifetime: config.dataCacheLifetime || 300000, // Время жизни кэша данных (5 минут)
      balanceCacheLifetime: config.balanceCacheLifetime || 60000, // Время жизни кэша баланса (1 минута)
      
      // Расширенные настройки
      enablePartialTakeProfit: config.enablePartialTakeProfit !== false, // Включить частичное закрытие по TP
      partialTakeProfitLevels: config.partialTakeProfitLevels || [0.3, 0.5, 0.7], // Уровни для частичного закрытия
      dynamicPositionSizing: config.dynamicPositionSizing !== false, // Динамический размер позиции
      marketConditionsAdaptation: config.marketConditionsAdaptation !== false, // Адаптация к рыночным условиям
      backtestLookbackPeriod: config.backtestLookbackPeriod || 30, // Период анализа истории для оптимизации (дней)
      maxHistorySize: config.maxHistorySize || 1000, // Максимальный размер истории сеток
      
      // Объединяем с дополнительными настройками
      ...config
    };
  }

  /**
   * Проверяет, сработал ли трейлинг-стоп
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если трейлинг-стоп сработал
   * @private
   */
  _isTrailingStopTriggered(grid, currentPrice) {
    if (grid.trailingStopValue === null) {
      return false;
    }
    
    if (grid.direction === 'BUY') {
      return currentPrice <= grid.trailingStopValue;
    } else { // SELL
      return currentPrice >= grid.trailingStopValue;
    }
  }

  /**
   * Проверяет, нужно ли произвести частичное закрытие по тейк-профиту
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно частично закрыть
   * @private
   */
  _shouldTakePartialProfit(grid, currentPrice) {
    if (!grid.enablePartialTakeProfit || !grid.partialTakeProfitLevels.length) {
      return false;
    }
    
    // Определяем текущий уровень прибыли
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    if (openPositions.length === 0) {
      return false;
    }
    
    // Рассчитываем среднюю цену входа
    const totalInvested = openPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
    const totalSize = openPositions.reduce((sum, pos) => sum + pos.size, 0);
    const avgEntryPrice = totalInvested / totalSize;
    
    // Рассчитываем текущий процент прибыли
    let profitPercent;
    if (grid.direction === 'BUY') {
      profitPercent = (currentPrice - avgEntryPrice) / avgEntryPrice * 100;
    } else { // SELL
      profitPercent = (avgEntryPrice - currentPrice) / avgEntryPrice * 100;
    }
    
    // Проверяем, достиг ли процент прибыли одного из уровней
    const targetLevel = grid.partialTakeProfitLevels.find(level => {
      // Проверяем, не был ли этот уровень уже исполнен
      if (grid.partialTakeProfitExecuted.includes(level)) {
        return false;
      }
      
      // Рассчитываем требуемый процент прибыли для этого уровня
      const requiredPercent = level * grid.params.takeProfitDistance / avgEntryPrice * 100;
      
      // Проверяем, достигнут ли требуемый процент
      return profitPercent >= requiredPercent;
    });
    
    return targetLevel !== undefined;
  }

  /**
   * Выполняет частичное закрытие позиций по тейк-профиту
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _executePartialTakeProfit(gridId, grid, currentPrice) {
    try {
      // Находим открытые позиции
      const openPositions = grid.positions.filter(p => p.status === 'OPEN');
      if (openPositions.length === 0) {
        return false;
      }
      
      // Рассчитываем среднюю цену входа
      const totalInvested = openPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
      const totalSize = openPositions.reduce((sum, pos) => sum + pos.size, 0);
      const avgEntryPrice = totalInvested / totalSize;
      
      // Рассчитываем текущий процент прибыли
      let profitPercent;
      if (grid.direction === 'BUY') {
        profitPercent = (currentPrice - avgEntryPrice) / avgEntryPrice * 100;
      } else { // SELL
        profitPercent = (avgEntryPrice - currentPrice) / avgEntryPrice * 100;
      }
      
      // Находим первый неисполненный уровень, который достигнут
      for (const level of grid.partialTakeProfitLevels) {
        // Пропускаем, если уровень уже исполнен
        if (grid.partialTakeProfitExecuted.includes(level)) {
          continue;
        }
        
        // Рассчитываем требуемый процент прибыли для этого уровня
        const requiredPercent = level * grid.params.takeProfitDistance / avgEntryPrice * 100;
        
        // Если уровень еще не достигнут, прерываем цикл
        if (profitPercent < requiredPercent) {
          break;
        }
        
        // Закрываем часть позиций, соответствующую этому уровню
        const positionsToClose = this._selectPositionsForPartialClose(grid, level);
        
        if (positionsToClose.length > 0) {
          // Закрываем выбранные позиции по текущей цене
          await this._closePositionsAtMarket(gridId, positionsToClose, currentPrice, `PARTIAL_TP_${level}`);
          
          // Добавляем уровень в список исполненных
          grid.partialTakeProfitExecuted.push(level);
          
          this.log(`Выполнено частичное закрытие для сетки ${gridId} на уровне ${level} (${profitPercent.toFixed(2)}%)`);
          
          // Оповещаем о частичном закрытии
          this._emitGridEvent('grid.partialTakeProfit', {
            gridId,
            level,
            profitPercent: profitPercent.toFixed(2),
            closedPositions: positionsToClose.length,
            price: currentPrice
          });
          
          // Обновляем сетку
          this.activeGrids.set(gridId, grid);
        }
      }
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при выполнении частичного закрытия для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Выбирает позиции для частичного закрытия
   * @param {Object} grid - Объект сетки
   * @param {number} level - Уровень частичного закрытия (0-1)
   * @returns {Array} - Массив позиций для закрытия
   * @private
   */
  _selectPositionsForPartialClose(grid, level) {
    // Находим открытые позиции
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    
    // Сортируем позиции от наименее выгодных к наиболее выгодным
    const sortedPositions = [...openPositions].sort((a, b) => {
      if (grid.direction === 'BUY') {
        return b.entryPrice - a.entryPrice; // Для покупок: от высоких к низким ценам
      } else {
        return a.entryPrice - b.entryPrice; // Для продаж: от низких к высоким ценам
      }
    });
    
    // Определяем количество позиций для закрытия
    const totalPositions = sortedPositions.length;
    const positionsToClose = Math.ceil(totalPositions * level);
    
    return sortedPositions.slice(0, positionsToClose);
  }

  /**
   * Закрывает позиции по рыночной цене
   * @param {string} gridId - Идентификатор сетки
   * @param {Array} positions - Массив позиций для закрытия
   * @param {number} price - Цена закрытия
   * @param {string} reason - Причина закрытия
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _closePositionsAtMarket(gridId, positions, price, reason) {
    if (!this.activeGrids.has(gridId) || positions.length === 0) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Для каждой позиции создаем рыночный ордер на закрытие
      for (const position of positions) {
        if (position.status !== 'OPEN') {
          continue;
        }
        
        // Создаем рыночный ордер для закрытия позиции
        const orderResult = await exchange.createOrder(
          grid.pair,
          grid.direction === 'BUY' ? 'SELL' : 'BUY', // Противоположное направление
          'MARKET',
          position.size
        );
        
        // Обновляем позицию
        position.status = 'CLOSED';
        position.closeTime = Date.now();
        position.closePrice = price;
        position.closeOrderId = orderResult.orderId;
        position.closeReason = reason;
        
        // Рассчитываем прибыль/убыток
        const profit = grid.direction === 'BUY' ? 
          (price - position.entryPrice) * position.size : 
          (position.entryPrice - price) * position.size;
        
        position.profit = profit;
        
        // Обновляем статистику сетки
        grid.stats.totalProfit += profit;
        grid.stats.closedPositions++;
        
        // Отменяем другие ордера для этой позиции
        this._cancelOtherPositionOrders(gridId, position);
        
        this.log(`Закрыта позиция ${position.id} в сетке ${gridId} с прибылью ${profit}`);
      }
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при закрытии позиций для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет необходимость исполнения отложенных ордеров
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<void>}
   * @private
   */
  async _checkPendingOrders(gridId, grid, currentPrice) {
    // Проверяем, есть ли активные ордера на вход
    const pendingEntryOrders = grid.entryOrders.filter(o => o.status === 'PENDING');
    
    // Если нет отложенных ордеров, выходим
    if (pendingEntryOrders.length === 0) {
      return;
    }
    
    // Проверяем, не пора ли разместить следующий ордер
    const lowestLevelActive = grid.entryOrders
      .filter(o => o.status === 'ACTIVE' || o.status === 'FILLED')
      .reduce((min, o) => Math.min(min, o.level), Infinity);
    
    // Если нет активных ордеров, размещаем первый
    if (lowestLevelActive === Infinity) {
      const nextOrder = pendingEntryOrders[0];
      await this._placeOrderOnExchange(gridId, nextOrder);
      return;
    }
    
    // Проверяем, достигла ли цена уровня для следующего ордера
    const nextLevel = lowestLevelActive + 1;
    const nextOrder = grid.entryOrders.find(o => o.level === nextLevel && o.status === 'PENDING');
    
    if (!nextOrder) {
      return;
    }
    
    // Проверяем, пересекла ли цена уровень ордера
    const isPriceCrossed = grid.direction === 'BUY' ? 
      currentPrice <= nextOrder.price * 1.01 : // Допуск 1%
      currentPrice >= nextOrder.price * 0.99;  // Допуск 1%
    
    if (isPriceCrossed) {
      await this._placeOrderOnExchange(gridId, nextOrder);
    }
  }

  /**
   * Проверяет, нужно ли закрыть сетку по тейк-профиту
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно закрыть
   * @private
   */
  _shouldCloseGridByTakeProfit(grid, currentPrice) {
    // Если нет открытых позиций, не закрываем сетку
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    if (openPositions.length === 0) {
      return false;
    }
    
    // Проверяем, достигли ли все позиции своих тейк-профитов
    const allPositionsClosed = grid.positions.length > 0 && 
      grid.positions.every(p => p.status === 'CLOSED');
    
    // Если все позиции закрыты, закрываем сетку
    if (allPositionsClosed) {
      return true;
    }
    
    // Дополнительно проверяем, достигла ли сетка общего уровня тейк-профита
    const totalProfit = grid.stats.totalProfit;
    const totalInvested = grid.positions.reduce((sum, pos) => {
      if (pos.status === 'OPEN' || pos.status === 'CLOSED') {
        return sum + (pos.entryPrice * pos.size);
      }
      return sum;
    }, 0);
    
    // Если инвестировано мало или ничего, не закрываем сетку
    if (totalInvested < 0.0001) {
      return false;
    }
    
    // Рассчитываем процент прибыли
    const profitPercent = (totalProfit / totalInvested) * 100;
    
    // Проверяем, достигнут ли целевой процент прибыли
    return profitPercent >= this.config.targetProfitPercent;
  }

  /**
   * Корректирует параметры сетки в зависимости от рыночных условий
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _adjustGridIfNeeded(gridId, grid, currentPrice) {
    // Пока сетка активна, не корректируем её параметры
    if (grid.status !== 'ACTIVE') {
      return false;
    }
    
    try {
      // Получаем актуальные данные для анализа
      const chartData = await this._getChartDataForAnalysis(grid.pair);
      
      // Рассчитываем новый ATR
      const currentATR = this._calculateATR(chartData, this.config.atrPeriod);
      
      // Если ATR изменился значительно, корректируем параметры сетки
      const atrChangeRatio = currentATR / grid.params.atr;
      
      if (atrChangeRatio < 0.7 || atrChangeRatio > 1.5) {
        this.log(`Значительное изменение волатильности для сетки ${gridId}: ATR ${grid.params.atr} -> ${currentATR}`);
        
        // Корректируем шаг сетки
        const newGridStep = currentATR * this.config.gridSpacingATRMultiplier;
        
        // Обновляем параметры сетки
        grid.params.atr = currentATR;
        grid.params.gridStep = newGridStep;
        
        // Для ордеров, которые еще не размещены, корректируем цены
        for (let i = 0; i < grid.entryOrders.length; i++) {
          const order = grid.entryOrders[i];
          
          if (order.status === 'PENDING') {
            // Пересчитываем цену ордера
            if (grid.direction === 'BUY') {
              order.price = grid.startPrice - (i * newGridStep);
            } else { // SELL
              order.price = grid.startPrice + (i * newGridStep);
            }
            
            // Обновляем соответствующие ордера тейк-профита и стоп-лосса
            const tpOrder = grid.takeProfitOrders.find(o => o.entryOrderId === order.id);
            const slOrder = grid.stopLossOrders.find(o => o.entryOrderId === order.id);
            
            if (tpOrder) {
              tpOrder.price = grid.direction === 'BUY' ? 
                order.price + (newGridStep * this.config.takeProfitFactor) : 
                order.price - (newGridStep * this.config.takeProfitFactor);
            }
            
            if (slOrder) {
              slOrder.price = grid.direction === 'BUY' ? 
                order.price - (newGridStep * this.config.stopLossFactor) : 
                order.price + (newGridStep * this.config.stopLossFactor);
            }
          }
        }
        
        // Корректируем дистанции для тейк-профита и стоп-лосса
        grid.params.takeProfitDistance = newGridStep * this.config.takeProfitFactor;
        grid.params.stopLossDistance = newGridStep * this.config.stopLossFactor;
        
        // Обновляем сетку
        grid.lastUpdateTime = Date.now();
        this.activeGrids.set(gridId, grid);
        
        this.log(`Параметры сетки ${gridId} скорректированы в соответствии с изменением волатильности`);
        
        // Оповещаем о корректировке сетки
        this._emitGridEvent('grid.adjusted', {
          gridId,
          oldATR: grid.params.atr,
          newATR: currentATR,
          oldGridStep: grid.params.gridStep,
          newGridStep
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logError(`Ошибка при корректировке параметров сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет завершение сетки
   * @param {string} gridId - Идентификатор сетки
   * @private
   */
  _checkGridCompletion(gridId) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Проверяем, все ли позиции закрыты
    const allPositionsClosed = grid.positions.length > 0 && 
      grid.positions.every(p => p.status === 'CLOSED');
    
    // Проверяем, есть ли активные ордера
    const hasActiveOrders = grid.entryOrders.some(o => o.status === 'ACTIVE') || 
      grid.takeProfitOrders.some(o => o.status === 'ACTIVE') || 
      grid.stopLossOrders.some(o => o.status === 'ACTIVE');
    
    // Если все позиции закрыты и нет активных ордеров, закрываем сетку
    if (allPositionsClosed && !hasActiveOrders) {
      this.log(`Все позиции в сетке ${gridId} закрыты, завершаем сетку`);
      
      this.completeGrid(gridId, 'ALL_POSITIONS_CLOSED')
        .catch(error => this.logError(`Ошибка при завершении сетки ${gridId}`, error));
    }
  }

  /**
   * Завершает сетку
   * @param {string} gridId - Идентификатор сетки
   * @param {string} reason - Причина завершения
   * @returns {Promise<boolean>} - Результат операции
   */
  async completeGrid(gridId, reason) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    try {
      const grid = this.activeGrids.get(gridId);
      
      // Отменяем все активные ордера
      await this._cancelAllGridOrders(gridId);
      
      // Обновляем статус сетки
      grid.status = 'COMPLETED';
      grid.completedAt = Date.now();
      grid.completionReason = reason;
      
      // Сохраняем статистику
      grid.stats.finalProfit = grid.stats.totalProfit;
      grid.stats.duration = grid.completedAt - grid.createdAt;
      
      // Обновляем статистику модуля
      this.moduleStats.totalGridsCompleted++;
      this.moduleStats.totalProfit += grid.stats.finalProfit;
      
      if (grid.stats.finalProfit > 0) {
        this.moduleStats.successfulGrids++;
      }
      
      // Обновляем среднее время завершения
      const prevTotal = (this.moduleStats.totalGridsCompleted - 1) * this.moduleStats.avgCompletionTime;
      this.moduleStats.avgCompletionTime = (prevTotal + grid.stats.duration) / this.moduleStats.totalGridsCompleted;
      this.moduleStats.lastUpdate = Date.now();
      
      // Перемещаем сетку в историю
      this.gridHistory.push(grid);
      this.activeGrids.delete(gridId);
      
      // Сохраняем данные
      await this._saveData();
      
      this.log(`Сетка ${gridId} завершена: ${reason}. Итоговая прибыль: ${grid.stats.finalProfit}`);
      
      // Оповещаем о завершении сетки
      this._emitGridEvent('grid.completed', {
        gridId,
        reason,
        profit: grid.stats.finalProfit,
        duration: grid.stats.duration
      });
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при завершении сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Закрывает сетку
   * @param {string} gridId - Идентификатор сетки
   * @param {string} reason - Причина закрытия
   * @returns {Promise<boolean>} - Результат операции
   */
  async closeGrid(gridId, reason) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    try {
      const grid = this.activeGrids.get(gridId);
      
      // Закрываем все открытые позиции
      const openPositions = grid.positions.filter(p => p.status === 'OPEN');
      
      if (openPositions.length > 0) {
        // Получаем текущую цену
        const currentPrice = await this._getCurrentPrice(grid.pair);
        
        // Закрываем все открытые позиции по рыночной цене
        await this._closePositionsAtMarket(gridId, openPositions, currentPrice, reason);
      }
      
      // Завершаем сетку
      return await this.completeGrid(gridId, reason);
    } catch (error) {
      this.logError(`Ошибка при закрытии сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Отменяет все активные ордера сетки
   * @param {string} gridId - Идентификатор сетки
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _cancelAllGridOrders(gridId) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Собираем все активные ордера
      const activeOrders = [
        ...grid.entryOrders.filter(o => o.status === 'ACTIVE'),
        ...grid.takeProfitOrders.filter(o => o.status === 'ACTIVE'),
        ...grid.stopLossOrders.filter(o => o.status === 'ACTIVE')
      ];
      
      // Отменяем каждый ордер
      for (const order of activeOrders) {
        if (order.exchangeOrderId) {
          try {
            await exchange.cancelOrder(grid.pair, order.exchangeOrderId);
            order.status = 'CANCELED';
            order.updatedAt = Date.now();
          } catch (error) {
            this.logError(`Ошибка при отмене ордера ${order.id}`, error);
          }
        }
      }
      
      this.log(`Отменено ${activeOrders.length} активных ордеров для сетки ${gridId}`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при отмене ордеров сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Получение активных сеток
   * @returns {Array} - Массив активных сеток
   */
  getActiveGrids() {
    return Array.from(this.activeGrids.values());
  }

  /**
   * Получение истории сеток
   * @param {number} [limit=50] - Максимальное количество записей
   * @returns {Array} - Массив записей истории
   */
  getGridHistory(limit = 50) {
    // Возвращаем последние N записей, отсортированных по времени завершения
    return this.gridHistory
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  /**
   * Получение детальной информации о сетке
   * @param {string} gridId - Идентификатор сетки
   * @returns {Object|null} - Информация о сетке или null, если сетка не найдена
   */
  getGridInfo(gridId) {
    // Проверяем активные сетки
    if (this.activeGrids.has(gridId)) {
      return this.activeGrids.get(gridId);
    }
    
    // Проверяем историю
    const historicalGrid = this.gridHistory.find(g => g.id === gridId);
    
    return historicalGrid || null;
  }

  /**
   * Генерирует событие сетки
   * @param {string} eventType - Тип события
   * @param {Object} data - Данные события
   * @private
   */
  _emitGridEvent(eventType, data) {
    if (!this.core) return;
    
    // Добавляем общие метаданные события
    const eventData = {
      ...data,
      timestamp: Date.now(),
      moduleId: this.id
    };
    
    // Публикуем событие через ядро
    this.core.emit(eventType, eventData);
  }

  /**
   * Отменяет другие ордера для закрытой позиции
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} position - Закрытая позиция
   * @private
   */
  _cancelOtherPositionOrders(gridId, position) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим активные ордера для этой позиции
    const tpOrder = grid.takeProfitOrders.find(o => 
      o.positionId === position.id && o.status === 'ACTIVE' && o.id !== position.closeOrderId);
    
    const slOrder = grid.stopLossOrders.find(o => 
      o.positionId === position.id && o.status === 'ACTIVE' && o.id !== position.closeOrderId);
    
    // Отменяем найденные ордера
    if (tpOrder) {
      this._cancelOrderOnExchange(gridId, tpOrder)
        .catch(error => this.logError(`Ошибка при отмене TP ордера ${tpOrder.id}`, error));
    }
    
    if (slOrder) {
      this._cancelOrderOnExchange(gridId, slOrder)
        .catch(error => this.logError(`Ошибка при отмене SL ордера ${slOrder.id}`, error));
    }
  }

  /**
   * Отменяет ордер на бирже
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Ордер для отмены
   * @returns {Promise<boolean>} - Результат отмены ордера
   * @private
   */
  async _cancelOrderOnExchange(gridId, order) {
    if (!this.activeGrids.has(gridId) || !order.exchangeOrderId) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Отменяем ордер на бирже
      await exchange.cancelOrder(grid.pair, order.exchangeOrderId);
      
      // Обновляем статус ордера
      order.status = 'CANCELED';
      order.updatedAt = Date.now();
      
      this.log(`Отменен ордер ${order.id} для сетки ${gridId}`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при отмене ордера ${order.id} для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет, нужно ли закрыть сетку по стоп-лоссу
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно закрыть
   * @private
   */
  _shouldCloseGridByStopLoss(grid, currentPrice) {
    // Проверка на максимальную просадку
    const totalInvested = grid.entryOrders.reduce((sum, order) => {
      if (order.status === 'FILLED') {
        return sum + (order.fillPrice * order.size);
      }
      return sum;
    }, 0);
    
    // Если нет открытых позиций, не закрываем сетку
    if (totalInvested === 0) {
      return false;
    }
    
    // Текущая стоимость открытых позиций
    const currentValue = grid.positions.reduce((sum, position) => {
      if (position.status === 'OPEN') {
        return sum + (currentPrice * position.size);
      }
      return sum;
    }, 0);
    
    // Текущая прибыль/убыток
    const currentPL = grid.direction === 'BUY' ? 
      currentValue - totalInvested : 
      totalInvested - currentValue;
    
    // Процент просадки
    const drawdownPercent = (currentPL / totalInvested) * 100;
    
    // Обновляем максимальную просадку
    if (drawdownPercent < 0 && Math.abs(drawdownPercent) > Math.abs(grid.stats.maxDrawdown)) {
      grid.stats.maxDrawdown = drawdownPercent;
    }
    
    // Проверяем, не превышена ли максимальная просадка
    return drawdownPercent < 0 && Math.abs(drawdownPercent) >= this.config.maxDrawdownPercent;
  }

  /**
   * Проверяет, нужно ли активировать трейлинг-стоп
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно активировать
   * @private
   */
  _shouldActivateTrailingStop(grid, currentPrice) {
    if (!grid.trailingStopEnabled || grid.trailingStopValue !== null) {
      return false;
    }
    
    // Проверяем, достигла ли цена уровня активации трейлинг-стопа
    if (grid.direction === 'BUY') {
      return currentPrice >= grid.params.trailingStopActivationLevel;
    } else { // SELL
      return currentPrice <= grid.params.trailingStopActivationLevel;
    }
  }

  /**
   * Обновляет значение трейлинг-стопа
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @private
   */
  _updateTrailingStop(gridId, grid, currentPrice) {
    // Инициализируем трейлинг-стоп, если он еще не активирован
    if (grid.trailingStopValue === null) {
      const distance = grid.params.gridStep * (this.config.stopLossFactor / 2); // Половина обычного стоп-лосса
      
      grid.trailingStopValue = grid.direction === 'BUY' ? 
        currentPrice - distance : 
        currentPrice + distance;
      
      this.log(`Активирован трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
      
      // Оповещаем об активации трейлинг-стопа
      this._emitGridEvent('grid.trailingStop.activated', {
        gridId,
        value: grid.trailingStopValue,
        activationPrice: currentPrice
      });
    } else {
      // Обновляем трейлинг-стоп, если текущая цена обеспечивает лучший уровень
      if (grid.direction === 'BUY' && (currentPrice - grid.params.gridStep) > grid.trailingStopValue) {
        // Для покупки: повышаем стоп, когда цена растет
        grid.trailingStopValue = currentPrice - grid.params.gridStep;
        
        this.log(`Обновлен трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
        
        // Оповещаем об обновлении трейлинг-стопа
        this._emitGridEvent('grid.trailingStop.updated', {
          gridId,
          value: grid.trailingStopValue,
          currentPrice
        });
      } else if (grid.direction === 'SELL' && (currentPrice + grid.params.gridStep) < grid.trailingStopValue) {
        // Для продажи: понижаем стоп, когда цена падает
        grid.trailingStopValue = currentPrice + grid.params.gridStep;
        
        this.log(`Обновлен трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
        
        // Оповещаем об обновлении трейлинг-стопа
        this._emitGridEvent('grid.trailingStop.updated', {
          gridId,
          value: grid.trailingStopValue,
          currentPrice
        });
      }
    }
    
    // Проверяем, не сработал ли трейлинг-стоп
    if (this._isTrailingStopTriggered(grid, currentPrice)) {
      this.log(`Сработал трейлинг-стоп для сетки ${gridId} при цене ${currentPrice}`);
      
      // Закрываем сетку по трейлинг-стопу
      this.closeGrid(gridId, 'TRAILING_STOP')
        .catch(error => this.logError(`Ошибка при закрытии сетки ${gridId} по трейлинг-стопу`, error));
    }
    
    // Обновляем сетку
    this.activeGrids.set(gridId, grid);
  }

  /**
   * Инициализация модуля
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    try {
      this.log('Инициализация модуля Adaptive Smart Grid...');
      this.core = core;
      
      // Создаем директорию для данных, если она не существует
      await this._ensureDataDirectory();
      
      // Загружаем сохраненные данные
      await this._loadSavedData();
      
      // Регистрируем обработчики событий
      this._registerEventHandlers();
      
      // Запускаем интервал проверки статуса сеток
      this._startGridStatusChecking();
      
      this.isInitialized = true;
      this.log('Модуль Adaptive Smart Grid успешно инициализирован');
      
      return true;
    } catch (error) {
      this.logError('Ошибка инициализации модуля Adaptive Smart Grid', error);
      throw error;
    }
  }

  /**
   * Создает директорию для данных, если она не существует
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Игнорируем ошибку, если директория уже существует
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Загружает сохраненные данные
   * @returns {Promise<void>}
   * @private
   */
  async _loadSavedData() {
    try {
      // Загружаем активные сетки
      try {
        const gridsData = await fs.readFile(this.gridsFile, 'utf8');
        const grids = JSON.parse(gridsData);
        
        // Восстанавливаем Map из массива
        this.activeGrids = new Map(Object.entries(grids));
        this.log(`Загружено ${this.activeGrids.size} активных сеток`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Файл не существует, используем пустую Map
        this.activeGrids = new Map();
      }
      
      // Загружаем историю сеток
      try {
        const historyData = await fs.readFile(this.historyFile, 'utf8');
        this.gridHistory = JSON.parse(historyData);
        this.log(`Загружено ${this.gridHistory.length} записей истории сеток`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Файл не существует, используем пустой массив
        this.gridHistory = [];
      }

      // Загружаем статистику модуля
      try {
        const statsData = await fs.readFile(this.statsFile, 'utf8');
        this.moduleStats = JSON.parse(statsData);
        this.log(`Загружена статистика модуля: ${JSON.stringify(this.moduleStats)}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Файл не существует, используем начальные значения
        this.moduleStats = {
          totalGridsCreated: 0,
          totalGridsCompleted: 0,
          totalProfit: 0,
          successfulGrids: 0,
          avgCompletionTime: 0,
          lastUpdate: Date.now()
        };
      }
    } catch (error) {
      this.logError('Ошибка при загрузке сохраненных данных', error);
      // Инициализируем пустыми значениями при ошибке
      this.activeGrids = new Map();
      this.gridHistory = [];
      this.moduleStats = {
        totalGridsCreated: 0,
        totalGridsCompleted: 0,
        totalProfit: 0,
        successfulGrids: 0,
        avgCompletionTime: 0,
        lastUpdate: Date.now()
      };
    }
  }

  /**
   * Сохраняет текущие данные
   * @returns {Promise<void>}
   * @private
   */
  async _saveData() {
    try {
      // Преобразуем Map в объект для сохранения
      const gridsObject = Object.fromEntries(this.activeGrids);
      
      // Сохраняем активные сетки
      await fs.writeFile(this.gridsFile, JSON.stringify(gridsObject, null, 2));
      
      // Сохраняем историю сеток
      await fs.writeFile(this.historyFile, JSON.stringify(this.gridHistory, null, 2));
      
      // Сохраняем статистику модуля
      await fs.writeFile(this.statsFile, JSON.stringify(this.moduleStats, null, 2));
      
      this.log('Данные успешно сохранены');
    } catch (error) {
      this.logError('Ошибка при сохранении данных', error);
    }
  }

  /**
   * Регистрирует обработчики событий
   * @private
   */
  _registerEventHandlers() {
    if (!this.core) return;
    
    // Обработчик изменения торговой пары
    this._addEventHandler('tradingPair.changed', this._onTradingPairChanged.bind(this));
    
    // Обработчик новых торговых сигналов
    this._addEventHandler('trading-signal', this._onTradingSignal.bind(this));
    
    // Обработчик исполнения ордеров
    this._addEventHandler('order.executed', this._onOrderExecuted.bind(this));
    
    // Обработчик закрытия позиции
    this._addEventHandler('position.closed', this._onPositionClosed.bind(this));
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
    // Можно добавить логику для корректировки существующих сеток при изменении пары
  }

  /**
   * Обработчик новых торговых сигналов
   * @param {Object} data - Данные события
   * @private
   */
  _onTradingSignal(data) {
    const signal = data.signal;
    
    this.log(`Получен торговый сигнал: ${signal.direction} ${signal.pair} (уверенность: ${signal.confidence})`);
    
    // Проверяем, подходит ли сигнал для создания сетки
    if (this._isValidSignalForGrid(signal)) {
      // Создаем новую сетку на основе сигнала
      this.createGridFromSignal(signal)
        .then(result => {
          this.log(`Сетка создана: ${result.gridId}`);
        })
        .catch(error => {
          this.logError(`Ошибка при создании сетки: ${error.message}`, error);
        });
    } else {
      this.log('Сигнал не соответствует критериям для создания сетки');
    }
  }

  /**
   * Проверяет, подходит ли сигнал для создания сетки
   * @param {Object} signal - Торговый сигнал
   * @returns {boolean} - true, если сигнал подходит
   * @private
   */
  _isValidSignalForGrid(signal) {
    // Проверка уровня уверенности
    if (signal.confidence < this.config.minimumSignalConfidence) {
      return false;
    }
    
    // Проверка количества существующих сеток
    if (this.activeGrids.size >= this.config.maxConcurrentGrids) {
      return false;
    }
    
    // Проверка наличия сетки для этой пары
    for (const [, grid] of this.activeGrids) {
      if (grid.pair === signal.pair) {
        return false;
      }
    }
    
    // Дополнительные проверки (например, тренд, волатильность и т.д.)
    return true;
  }

  /**
   * Обработчик исполнения ордеров
   * @param {Object} data - Данные события
   * @private
   */
  _onOrderExecuted(data) {
    const { orderId, gridId, status } = data;
    
    if (!gridId || !this.activeGrids.has(gridId)) {
      return;
    }
    
    this.log(`Ордер ${orderId} из сетки ${gridId} исполнен со статусом ${status}`);
    
    // Обновляем статус ордера в сетке
    this._updateOrderStatus(gridId, orderId, status, data);
  }

  /**
   * Обработчик закрытия позиции
   * @param {Object} data - Данные события
   * @private
   */
  _onPositionClosed(data) {
    const { positionId, gridId, profit } = data;
    
    if (!gridId || !this.activeGrids.has(gridId)) {
      return;
    }
    
    this.log(`Позиция ${positionId} из сетки ${gridId} закрыта с прибылью ${profit}`);
    
    // Обновляем информацию о позиции в сетке
    this._updatePositionStatus(gridId, positionId, 'CLOSED', data);
    
    // Проверяем, нужно ли закрыть всю сетку
    this._checkGridCompletion(gridId);
  }

  /**
   * Обновляет статус ордера в сетке
   * @param {string} gridId - Идентификатор сетки
   * @param {string} orderId - Идентификатор ордера
   * @param {string} status - Новый статус
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _updateOrderStatus(gridId, orderId, status, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Ищем ордер во всех списках
    let order = grid.entryOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    if (!order) {
      order = grid.takeProfitOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    }
    if (!order) {
      order = grid.stopLossOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    }
    
    if (!order) {
      this.logError(`Ордер ${orderId} не найден в сетке ${gridId}`);
      return;
    }
    
    // Обновляем статус ордера
    order.status = status;
    order.updatedAt = Date.now();
    
    // Добавляем дополнительные данные
    if (data.fillPrice) {
      order.fillPrice = data.fillPrice;
    }
    if (data.fillTime) {
      order.fillTime = data.fillTime;
    }
    
    // Если ордер исполнен, создаем позицию
    if (status === 'FILLED' && grid.entryOrders.includes(order)) {
      this._createPosition(gridId, order, data);
    }
    
    // Если исполнен ордер закрытия, обновляем соответствующую позицию
    if (status === 'FILLED' && 
        (grid.takeProfitOrders.includes(order) || grid.stopLossOrders.includes(order))) {
      this._updatePositionForClosedOrder(gridId, order, data);
    }
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    // Сохраняем данные
    this._saveData()
      .catch(error => this.logError('Ошибка при сохранении данных', error));
  }

  /**
   * Создает позицию на основе исполненного ордера
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Исполненный ордер
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _createPosition(gridId, order, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Создаем новую позицию
    const position = {
      id: `${gridId}_position_${order.level}`,
      entryOrderId: order.id,
      entryPrice: order.fillPrice || order.price,
      size: order.size,
      direction: grid.direction,
      status: 'OPEN',
      openTime: order.fillTime || Date.now(),
      level: order.level
    };
    
    // Добавляем позицию в список
    grid.positions.push(position);
    
    // Активируем соответствующие ордера тейк-профита и стоп-лосса
    this._activatePositionOrders(gridId, position);
    
    // Если это первый исполненный ордер, размещаем следующий в сетке
    const nextOrderLevel = order.level + 1;
    if (nextOrderLevel < grid.entryOrders.length) {
      const nextOrder = grid.entryOrders[nextOrderLevel];
      if (nextOrder.status === 'PENDING') {
        this._placeOrderOnExchange(gridId, nextOrder)
          .catch(error => this.logError(`Ошибка при размещении следующего ордера сетки ${gridId}`, error));
      }
    }
    
    // Обновляем статистику сетки
    grid.stats.filledOrders++;
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    this.log(`Создана новая позиция в сетке ${gridId}: ${position.id} (${position.entryPrice})`);
    
    // Оповещаем о создании позиции
    this._emitGridEvent('grid.position.opened', {
      gridId,
      positionId: position.id,
      level: position.level,
      price: position.entryPrice,
      size: position.size
    });
  }

  /**
   * Активирует ордера тейк-профита и стоп-лосса для позиции
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} position - Позиция
   * @private
   */
  async _activatePositionOrders(gridId, position) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Находим соответствующие ордера
      const tpOrder = grid.takeProfitOrders.find(o => o.entryOrderId === position.entryOrderId);
      const slOrder = grid.stopLossOrders.find(o => o.entryOrderId === position.entryOrderId);
      
      // Обновляем связь с позицией
      if (tpOrder) {
        tpOrder.positionId = position.id;
        await this._placeOrderOnExchange(gridId, tpOrder);
      }
      
      if (slOrder) {
        slOrder.positionId = position.id;
        await this._placeOrderOnExchange(gridId, slOrder);
      }
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
    } catch (error) {
      this.logError(`Ошибка при активации ордеров для позиции ${position.id}`, error);
    }
  }

  /**
   * Размещает ордер на бирже
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Ордер для размещения
   * @returns {Promise<boolean>} - Результат размещения ордера
   * @private
   */
  async _placeOrderOnExchange(gridId, order) {
    if (!this.activeGrids.has(gridId) || order.status !== 'PENDING') {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Определяем направление ордера
      let orderSide;
      if (grid.entryOrders.includes(order)) {
        orderSide = grid.direction;
      } else if (grid.takeProfitOrders.includes(order)) {
        orderSide = grid.direction === 'BUY' ? 'SELL' : 'BUY';
      } else if (grid.stopLossOrders.includes(order)) {
        orderSide = grid.direction === 'BUY' ? 'SELL' : 'BUY';
      } else {
        throw new Error(`Ордер ${order.id} не принадлежит сетке ${gridId}`);
      }
      
      // Создаем ордер на бирже
      const exchangeOrder = await exchange.createOrder(
        grid.pair,
        orderSide,
        'LIMIT',
        order.size,
        order.price
      );
      
      // Обновляем информацию об ордере
      order.exchangeOrderId = exchangeOrder.orderId;
      order.status = 'ACTIVE';
      order.updatedAt = Date.now();
      
      this.log(`Размещен ордер ${order.id} для сетки ${gridId} на уровне ${order.level} (${order.price})`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при размещении ордера ${order.id} для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Обновляет позицию при исполнении ордера закрытия
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Исполненный ордер закрытия
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _updatePositionForClosedOrder(gridId, order, data) {
    if (!this.activeGrids.has(gridId) || !order.positionId) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим позицию
    const position = grid.positions.find(p => p.id === order.positionId);
    
    if (!position || position.status !== 'OPEN') {
      return;
    }
    
    // Обновляем позицию
    position.status = 'CLOSED';
    position.closeTime = order.fillTime || Date.now();
    position.closePrice = order.fillPrice || order.price;
    position.closeOrderId = order.id;
    position.closeReason = grid.takeProfitOrders.includes(order) ? 'TP' : 'SL';
    
    // Рассчитываем прибыль/убыток
    const profit = grid.direction === 'BUY' ? 
      (position.closePrice - position.entryPrice) * position.size : 
      (position.entryPrice - position.closePrice) * position.size;
    
    position.profit = profit;
    
    // Обновляем статистику сетки
    grid.stats.totalProfit += profit;
    grid.stats.closedPositions++;
    
    // Отменяем другие ордера для этой позиции
    this._cancelOtherPositionOrders(gridId, position);
    
    this.log(`Закрыта позиция ${position.id} в сетке ${gridId} с прибылью ${profit}`);
    
    // Оповещаем о закрытии позиции
    this._emitGridEvent('grid.position.closed', {
      gridId,
      positionId: position.id,
      price: position.closePrice,
      reason: position.closeReason,
      profit
    });
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    // Проверяем, нужно ли закрыть всю сетку
    this._checkGridCompletion(gridId);
  }

  /**
   * Обновляет статус позиции
   * @param {string} gridId - Идентификатор сетки
   * @param {string} positionId - Идентификатор позиции
   * @param {string} status - Новый статус
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _updatePositionStatus(gridId, positionId, status, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим позицию
    const position = grid.positions.find(p => p.id === positionId);
    
    if (!position) {
      this.logError(`Позиция ${positionId} не найдена в сетке ${gridId}`);
      return;
    }
    
    // Обновляем статус позиции
    position.status = status;
    
    // Добавляем дополнительные данные
    if (data.closePrice) {
      position.closePrice = data.closePrice;
    }
    if (data.closeTime) {
      position.closeTime = data.closeTime;
    }
    if (data.closeReason) {
      position.closeReason = data.closeReason;
    }
    if (data.profit !== undefined) {
      position.profit = data.profit;
      grid.stats.totalProfit += position.profit;
      grid.stats.closedPositions++;
    }
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    // Сохраняем данные
    this._saveData()
      .catch(error => this.logError('Ошибка при сохранении данных', error));
  }

  /**
   * Запускает интервал проверки статуса сеток
   * @private
   */
  _startGridStatusChecking() {
    // Останавливаем предыдущий интервал, если он существует
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Запускаем проверку сразу
    this._checkAllGridsStatus()
      .catch(error => this.logError('Ошибка при проверке статуса сеток', error));
    
    // Запускаем интервал для регулярной проверки
    this.checkInterval = setInterval(async () => {
      try {
        await this._checkAllGridsStatus();
      } catch (error) {
        this.logError('Ошибка при проверке статуса сеток', error);
      }
    }, this.config.statusCheckInterval);
    
    this.log(`Запущен интервал проверки статуса сеток (${this.config.statusCheckInterval}ms)`);
  }

  /**
   * Проверяет статус всех активных сеток
   * @returns {Promise<void>}
   * @private
   */
  async _checkAllGridsStatus() {
    if (this.activeGrids.size === 0) {
      return;
    }
    
    this.log(`Проверка статуса ${this.activeGrids.size} активных сеток`);
    
    // Проверяем каждую активную сетку
    for (const [gridId, grid] of this.activeGrids) {
      try {
        // Пропускаем завершенные сетки
        if (grid.status === 'COMPLETED') {
          continue;
        }
        
        // Получаем текущую цену для пары
        const currentPrice = await this._getCurrentPrice(grid.pair);
        
        // Проверяем необходимость закрытия сетки по стоп-лоссу
        if (this._shouldCloseGridByStopLoss(grid, currentPrice)) {
          this.log(`Сетка ${gridId} достигла максимальной просадки, закрываем`);
          await this.closeGrid(gridId, 'STOP_LOSS');
          continue;
        }
        
        // Проверяем необходимость закрытия сетки по тейк-профиту
        if (this._shouldCloseGridByTakeProfit(grid, currentPrice)) {
          this.log(`Сетка ${gridId} достигла целевой прибыли, закрываем`);
          await this.closeGrid(gridId, 'TAKE_PROFIT');
          continue;
        }
        
        // Проверяем необходимость активации трейлинг-стопа
        if (this._shouldActivateTrailingStop(grid, currentPrice)) {
          this._updateTrailingStop(gridId, grid, currentPrice);
        } else if (grid.trailingStopValue !== null) {
          // Обновляем значение трейлинг-стопа, если он уже активирован
          this._updateTrailingStop(gridId, grid, currentPrice);
        }
        
        // Проверяем необходимость частичного закрытия по тейк-профиту
        if (this._shouldTakePartialProfit(grid, currentPrice)) {
          await this._executePartialTakeProfit(gridId, grid, currentPrice);
        }
        
        // Проверяем необходимость размещения отложенных ордеров
        await this._checkPendingOrders(gridId, grid, currentPrice);
        
        // Корректируем параметры сетки, если необходимо
        await this._adjustGridIfNeeded(gridId, grid, currentPrice);
      } catch (error) {
        this.logError(`Ошибка при проверке статуса сетки ${gridId}`, error);
      }
    }
  }

  /**
   * Получает текущую цену для пары
   * @param {string} pair - Торговая пара
   * @returns {Promise<number>} - Текущая цена
   * @private
   */
  async _getCurrentPrice(pair) {
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Получаем текущую цену
      const ticker = await exchange.getTicker(pair);
      
      return parseFloat(ticker.lastPrice);
    } catch (error) {
      this.logError(`Ошибка при получении текущей цены для ${pair}`, error);
      throw error;
    }
  }

  /**
   * Получает данные графика для анализа
   * @param {string} pair - Торговая пара
   * @param {string} [interval='1h'] - Интервал свечей
   * @param {number} [limit=100] - Количество свечей
   * @returns {Promise<Array>} - Данные графика
   * @private
   */
  async _getChartDataForAnalysis(pair, interval = '1h', limit = 100) {
    try {
      // Проверяем кэш
      const cacheKey = `${pair}_${interval}_${limit}`;
      const cachedData = this.calculationCache.chartData.get(cacheKey);
      
      // Если данные есть в кэше и они не устарели, возвращаем их
      if (cachedData && 
          (Date.now() - cachedData.timestamp) < this.config.dataCacheLifetime) {
        return cachedData.data;
      }
      
      // Получаем данные от ядра
      const chartData = await this.core.getChartData({
        symbol: pair,
        interval,
        limit
      });
      
      // Сохраняем в кэш
      this.calculationCache.chartData.set(cacheKey, {
        data: chartData,
        timestamp: Date.now()
      });
      
      return chartData;
    } catch (error) {
      this.logError(`Ошибка при получении данных графика для ${pair}`, error);
      throw error;
    }
  }

  /**
   * Рассчитывает ATR (Average True Range)
   * @param {Array} chartData - Данные графика
   * @param {number} period - Период для расчета
   * @returns {number} - Значение ATR
   * @private
   */
  _calculateATR(chartData, period) {
    if (chartData.length < period + 1) {
      return 0;
    }
    
    // Рассчитываем True Range для каждой свечи
    const trueRanges = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const high = parseFloat(chartData[i].high);
      const low = parseFloat(chartData[i].low);
      const prevClose = parseFloat(chartData[i - 1].close);
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    // Если данных недостаточно, возвращаем среднее значение
    if (trueRanges.length < period) {
      return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    }
    
    // Рассчитываем ATR
    let atr = 0;
    
    // Первое значение ATR - среднее TR за период
    for (let i = 0; i < period; i++) {
      atr += trueRanges[i];
    }
    atr /= period;
    
    // Последующие значения используют формулу: ATR = (prev_ATR * (period - 1) + TR) / period
    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }
    
    return atr;
  }

  /**
   * Создает новую сетку на основе торгового сигнала
   * @param {Object} signal - Торговый сигнал
   * @returns {Promise<Object>} - Созданная сетка
   */
  async createGridFromSignal(signal) {
    try {
      // Проверяем, не превышен ли лимит одновременных сеток
      if (this.activeGrids.size >= this.config.maxConcurrentGrids) {
        throw new Error('Превышен лимит одновременных сеток');
      }
      
      // Получаем данные графика для анализа
      const chartData = await this._getChartDataForAnalysis(signal.pair);
      
      // Рассчитываем ATR для определения шага сетки
      const atr = this._calculateATR(chartData, this.config.atrPeriod);
      
      // Создаем уникальный идентификатор для сетки
      const gridId = `grid_${signal.pair}_${Date.now()}`;
      
      // Определяем базовые параметры сетки
      const gridStep = atr * this.config.gridSpacingATRMultiplier;
      const takeProfitDistance = gridStep * this.config.takeProfitFactor;
      const stopLossDistance = gridStep * this.config.stopLossFactor;
      
      // Определяем размер позиции (можно добавить логику динамического расчета)
      const positionSize = this._calculatePositionSize(signal.pair);
      
      // Создаем объект сетки
      const grid = {
        id: gridId,
        pair: signal.pair,
        direction: signal.direction,
        startPrice: signal.entryPoint,
        createdAt: Date.now(),
        completedAt: null,
        status: 'ACTIVE',
        completionReason: null,
        lastUpdateTime: Date.now(),
        
        // Параметры сетки
        params: {
          atr,
          gridStep,
          takeProfitDistance,
          stopLossDistance,
          positionSize,
          gridLevels: this.config.defaultGridLevels,
          trailingStopActivationLevel: signal.direction === 'BUY' ? 
            signal.entryPoint + (takeProfitDistance * this.config.trailingStopActivationPercent) : 
            signal.entryPoint - (takeProfitDistance * this.config.trailingStopActivationPercent)
        },
        
        // Управление трейлинг-стопом
        trailingStopEnabled: this.config.trailingStopEnabled,
        trailingStopValue: null,
        
        // Управление частичным закрытием
        enablePartialTakeProfit: this.config.enablePartialTakeProfit,
        partialTakeProfitLevels: this.config.partialTakeProfitLevels,
        partialTakeProfitExecuted: [],
        
        // Ордера
        entryOrders: [],
        takeProfitOrders: [],
        stopLossOrders: [],
        
        // Позиции
        positions: [],
        
        // Статистика
        stats: {
          filledOrders: 0,
          closedPositions: 0,
          totalProfit: 0,
          maxDrawdown: 0,
          finalProfit: null,
          duration: null
        },
        
        // Исходный сигнал
        sourcedFromSignal: {
          id: signal.id || null,
          confidence: signal.confidence || null,
          source: signal.source || null,
          timestamp: signal.timestamp || Date.now()
        }
      };
      
      // Создаем ордера сетки
      this._generateGridOrders(grid);
      
      // Добавляем сетку в активные
      this.activeGrids.set(gridId, grid);
      
      // Обновляем статистику модуля
      this.moduleStats.totalGridsCreated++;
      this.moduleStats.lastUpdate = Date.now();
      
      // Размещаем первый ордер
      if (grid.entryOrders.length > 0) {
        await this._placeOrderOnExchange(gridId, grid.entryOrders[0]);
      }
      
      // Сохраняем данные
      await this._saveData();
      
      this.log(`Создана новая сетка ${gridId} для пары ${signal.pair} (${signal.direction})`);
      
      // Оповещаем о создании сетки
      this._emitGridEvent('grid.created', {
        gridId,
        pair: signal.pair,
        direction: signal.direction,
        levels: grid.params.gridLevels
      });
      
      return { gridId, grid };
    } catch (error) {
      this.logError('Ошибка при создании сетки', error);
      throw error;
    }
  }

  /**
   * Генерирует ордера для сетки
   * @param {Object} grid - Объект сетки
   * @private
   */
  _generateGridOrders(grid) {
    const { gridStep, positionSize } = grid.params;
    const startPrice = grid.startPrice;
    const direction = grid.direction;
    const levels = grid.params.gridLevels;
    
    // Очищаем существующие ордера
    grid.entryOrders = [];
    grid.takeProfitOrders = [];
    grid.stopLossOrders = [];
    
    // Генерируем ордера входа
    for (let i = 0; i < levels; i++) {
      const orderId = `${grid.id}_entry_${i}`;
      
      // Рассчитываем цену ордера
      let price;
      if (direction === 'BUY') {
        // Для покупок: понижаем цену с каждым уровнем
        price = startPrice - (i * gridStep);
      } else { // SELL
        // Для продаж: повышаем цену с каждым уровнем
        price = startPrice + (i * gridStep);
      }
      
      // Рассчитываем размер позиции (можно добавить логику масштабирования)
      const size = positionSize;
      
      // Создаем ордер входа
      const entryOrder = {
        id: orderId,
        level: i,
        price,
        size,
        status: 'PENDING',
        exchangeOrderId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fillPrice: null,
        fillTime: null
      };
      
      grid.entryOrders.push(entryOrder);
      
      // Создаем ордер тейк-профита
      const tpOrderId = `${grid.id}_tp_${i}`;
      const tpPrice = direction === 'BUY' ? 
        price + grid.params.takeProfitDistance : 
        price - grid.params.takeProfitDistance;
      
      const tpOrder = {
        id: tpOrderId,
        entryOrderId: orderId,
        positionId: null,
        price: tpPrice,
        size,
        status: 'PENDING',
        exchangeOrderId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fillPrice: null,
        fillTime: null
      };
      
      grid.takeProfitOrders.push(tpOrder);
      
      // Создаем ордер стоп-лосса
      const slOrderId = `${grid.id}_sl_${i}`;
      const slPrice = direction === 'BUY' ? 
        price - grid.params.stopLossDistance : 
        price + grid.params.stopLossDistance;
      
      const slOrder = {
        id: slOrderId,
        entryOrderId: orderId,
        positionId: null,
        price: slPrice,
        size,
        status: 'PENDING',
        exchangeOrderId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fillPrice: null,
        fillTime: null
      };
      
      grid.stopLossOrders.push(slOrder);
    }
  }

  /**
   * Рассчитывает размер позиции для сетки
   * @param {string} pair - Торговая пара
   * @returns {number} - Размер позиции
   * @private
   */
  _calculatePositionSize(pair) {
    // Базовый размер позиции из конфигурации
    let positionSize = this.config.defaultLotSize;
    
    // Если включен динамический размер позиции, рассчитываем его на основе баланса и риска
    if (this.config.dynamicPositionSizing) {
      try {
        // Получаем баланс (в реальной реализации нужно получать от биржи)
        const balance = this._getBalance();
        
        // Рассчитываем доступную сумму для позиции (% от баланса)
        const availableAmount = balance * (this.config.maxRiskPerTrade / 100);
        
        // Рассчитываем размер позиции (можно добавить логику с учетом текущей цены)
        positionSize = Math.max(this.config.minPositionSize, availableAmount / this.config.defaultGridLevels);
      } catch (error) {
        this.logError('Ошибка при расчете динамического размера позиции', error);
        // При ошибке используем базовый размер
      }
    }
    
    return positionSize;
  }

  /**
   * Получает текущий баланс (заглушка, в реальной реализации нужно получать от биржи)
   * @returns {number} - Текущий баланс
   * @private
   */
  _getBalance() {
    // Проверяем кэш
    if (this.calculationCache.balance.timestamp + this.config.balanceCacheLifetime > Date.now()) {
      return this.calculationCache.balance.data;
    }
    
    // В реальной реализации нужно получать от биржи
    const balance = this.config.initialCapital;
    
    // Обновляем кэш
    this.calculationCache.balance = {
      data: balance,
      timestamp: Date.now()
    };
    
    return balance;
  }

  /**
   * Получение статистики модуля
   * @returns {Object} - Статистика модуля
   */
  getStats() {
    const winRate = this.moduleStats.totalGridsCompleted > 0 ? 
      (this.moduleStats.successfulGrids / this.moduleStats.totalGridsCompleted) * 100 : 0;
    
    return {
      ...this.moduleStats,
      activeGrids: this.activeGrids.size,
      historicalGrids: this.gridHistory.length,
      winRate: Math.round(winRate * 100) / 100
    };
  }

  /**
   * Регистрирует API эндпоинты
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Получение списка активных сеток
    app.get('/api/adaptive-smart-grid/grids', (req, res) => {
      try {
        res.json({
          success: true,
          grids: this.getActiveGrids()
        });
      } catch (error) {
        this.logError('Ошибка при получении списка сеток', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение истории сеток
    app.get('/api/adaptive-smart-grid/history', (req, res) => {
      try {
        const limit = parseInt(req.query.limit || '50', 10);
        
        res.json({
          success: true,
          history: this.getGridHistory(limit)
        });
      } catch (error) {
        this.logError('Ошибка при получении истории сеток', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение информации о конкретной сетке
    app.get('/api/adaptive-smart-grid/grids/:id', (req, res) => {
      try {
        const grid = this.getGridInfo(req.params.id);
        
        if (!grid) {
          return res.status(404).json({
            success: false,
            error: 'Сетка не найдена'
          });
        }
        
        res.json({
          success: true,
          grid
        });
      } catch (error) {
        this.logError(`Ошибка при получении информации о сетке ${req.params.id}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Закрытие сетки
    app.post('/api/adaptive-smart-grid/grids/:id/close', async (req, res) => {
      try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const result = await this.closeGrid(id, reason || 'MANUAL');
        
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Сетка не найдена'
          });
        }
        
        res.json({
          success: true,
          message: `Сетка ${id} успешно закрыта`
        });
      } catch (error) {
        this.logError(`Ошибка при закрытии сетки ${req.params.id}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Создание новой сетки
    app.post('/api/adaptive-smart-grid/grids', async (req, res) => {
      try {
        const { pair, direction, entryPoint, confidence } = req.body;
        
        if (!pair || !direction || !entryPoint) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо указать pair, direction и entryPoint'
          });
        }
        
        // Создаем сигнал
        const signal = {
          pair,
          direction,
          entryPoint: parseFloat(entryPoint),
          confidence: parseFloat(confidence || '0.8'),
          timestamp: Date.now()
        };
        
        // Создаем сетку
        const result = await this.createGridFromSignal(signal);
        
        res.json({
          success: true,
          gridId: result.gridId,
          message: `Сетка успешно создана`
        });
      } catch (error) {
        this.logError('Ошибка при создании сетки', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение статистики модуля
    app.get('/api/adaptive-smart-grid/stats', (req, res) => {
      try {
        res.json({
          success: true,
          stats: this.getStats()
        });
      } catch (error) {
        this.logError('Ошибка при получении статистики', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Логирование сообщения
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[${this.id}] ${message}`);
    } else {
      console.log(`[${this.id}] ${message}`);
    }
  }

  /**
   * Логирование ошибки
   * @param {string} message - Сообщение об ошибке
   * @param {Error} [error] - Объект ошибки
   */
  logError(message, error) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[${this.id}] ${message}`, error);
    } else {
      console.error(`[${this.id}] ${message}`, error);
    }
  }

  /**
   * Очистка ресурсов при выгрузке модуля
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.log('Очистка ресурсов модуля Adaptive Smart Grid...');
    
    try {
      // Останавливаем интервал проверки
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      // Закрываем все активные сетки
      const activeGridIds = Array.from(this.activeGrids.keys());
      for (const gridId of activeGridIds) {
        try {
          await this.closeGrid(gridId, 'MODULE_UNLOAD');
        } catch (error) {
          this.logError(`Ошибка при закрытии сетки ${gridId}`, error);
        }
      }
      
      // Отписываемся от всех событий
      if (this.core) {
        for (const [eventType, handlers] of Object.entries(this.eventHandlers)) {
          for (const handler of handlers) {
            this.core.off(eventType, handler);
          }
        }
      }
      
      // Сохраняем все данные
      await this._saveData();
      
      this.isInitialized = false;
      this.log('Модуль Adaptive Smart Grid успешно выгружен');
    } catch (error) {
      this.logError('Ошибка при очистке ресурсов модуля', error);
      throw error;
    }
  }
}

module.exports = AdaptiveSmartGrid;