// modules/indicators/indicator-base.js
// Базовый класс для индикаторов

/**
 * Базовый класс для всех индикаторов
 */
class IndicatorBase {
  /**
   * Создает новый экземпляр базового индикатора
   * @param {Object} config - Конфигурация индикатора
   */
  constructor(config = {}) {
    this.id = this.constructor.name.toLowerCase(); // ID по умолчанию на основе имени класса
    this.name = this.constructor.name; // Название по умолчанию соответствует имени класса
    this.description = ''; // Описание индикатора
    this.config = { ...this.getDefaultConfig(), ...config }; // Конфигурация с настройками по умолчанию
    this.core = null; // Ссылка на ядро системы
    this.visible = config.visible !== undefined ? config.visible : true; // Видимость индикатора
    this.isInitialized = false; // Флаг инициализации
    this.lastResults = null; // Результаты последнего расчета
    this.tradingVueData = null; // Данные в формате для Trading Vue JS
  }
  
  /**
   * Получение настроек по умолчанию
   * @returns {Object} - Настройки по умолчанию
   */
  getDefaultConfig() {
    return {
      // Настройки, общие для всех индикаторов
      color: '#3B82F6', // Цвет по умолчанию
      lineWidth: 1.5, // Толщина линии по умолчанию
      visible: true, // Видимость по умолчанию
      showInLegend: true, // Показывать в легенде по умолчанию
      position: 'onchart' // Позиция индикатора: 'onchart' - на графике, 'offchart' - под графиком
    };
  }
  
  /**
   * Инициализация индикатора
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    this.core = core;
    this.isInitialized = true;
    return true;
  }
  
  /**
   * Расчет индикатора
   * @param {Array} chartData - Массив свечей для расчета
   * @returns {Promise<Object>} - Результат расчета
   */
  async calculate(chartData) {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      throw new Error('Нет данных для расчета индикатора');
    }
    
    try {
      // Здесь должен быть код расчета индикатора,
      // который должен быть переопределен в конкретных классах-потомках
      const result = await this._calculate(chartData);
      this.lastResults = result;
      
      // Преобразуем результаты в формат для Trading Vue JS
      this.tradingVueData = this._convertToTradingVueFormat(result);
      
      return result;
    } catch (error) {
      console.error(`Ошибка при расчете индикатора ${this.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Внутренний метод расчета индикатора, 
   * должен быть переопределен в дочерних классах
   * @param {Array} chartData - Массив свечей для расчета
   * @returns {Promise<Object>} - Результат расчета
   * @protected
   */
  async _calculate(chartData) {
    throw new Error('Метод _calculate должен быть переопределен в дочернем классе');
  }
  
  /**
   * Преобразование результатов расчета в формат для Trading Vue JS,
   * должен быть переопределен в дочерних классах
   * @param {Object} result - Результат расчета
   * @returns {Object} - Данные в формате для Trading Vue JS
   * @protected
   */
  _convertToTradingVueFormat(result) {
    throw new Error('Метод _convertToTradingVueFormat должен быть переопределен в дочернем классе');
  }
  
  /**
   * Получение данных для отрисовки индикатора
   * @returns {Object} - Данные для отрисовки
   */
  getVisualData() {
    if (!this.lastResults) {
      return null;
    }
    
    return {
      id: this.id,
      name: this.name,
      values: this.lastResults,
      color: this.config.color,
      lineWidth: this.config.lineWidth
    };
  }
  
  /**
   * Получение данных в формате для Trading Vue JS
   * @returns {Object} - Данные для Trading Vue JS
   */
  getTradingVueData() {
    return this.tradingVueData;
  }
  
  /**
   * Получение метаданных индикатора
   * @returns {Object} - Метаданные индикатора
   */
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      config: this.config,
      visible: this.visible,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Установка видимости индикатора
   * @param {boolean} visible - Новое состояние видимости
   * @returns {boolean} - Результирующее состояние видимости
   */
  setVisible(visible) {
    this.visible = !!visible;
    return this.visible;
  }
  
  /**
   * Обновление конфигурации индикатора
   * @param {Object} config - Новая конфигурация
   * @returns {Object} - Результирующая конфигурация
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Конфигурация должна быть объектом');
    }
    
    this.config = {
      ...this.config,
      ...config
    };
    
    // Сбрасываем кэшированные результаты, так как конфигурация изменилась
    this.lastResults = null;
    this.tradingVueData = null;
    
    return this.config;
  }
  
  /**
   * Очистка ресурсов при выгрузке индикатора
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.isInitialized = false;
    this.lastResults = null;
    this.tradingVueData = null;
    this.core = null;
  }
  
  /**
   * Вспомогательный метод для логирования
   * @param {string} message - Сообщение для логирования
   * @protected
   */
  _log(message) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[${this.name}] ${message}`);
    } else {
      console.log(`[${this.name}] ${message}`);
    }
  }
  
  /**
   * Вспомогательный метод для логирования ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} [error] - Объект ошибки
   * @protected
   */
  _logError(message, error) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[${this.name}] ${message}`, error);
    } else {
      console.error(`[${this.name}] ${message}`, error);
    }
  }
}

module.exports = IndicatorBase;