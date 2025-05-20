/**
 * Интерфейс для коннекторов бирж
 * Этот файл определяет общий интерфейс, которому должны следовать все коннекторы
 */

/**
 * Базовый класс для всех коннекторов бирж
 * @class
 */
class ExchangeConnectorInterface {
  /**
   * Создает экземпляр коннектора
   * @param {Object} apiConfig - Конфигурация API (ключи и настройки)
   */
  constructor(apiConfig = {}) {
    this.apiKey = apiConfig.apiKey || '';
    this.secretKey = apiConfig.secretKey || '';
    this.isInitialized = false;
  }

  /**
   * Инициализирует коннектор
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize() {
    throw new Error('Метод initialize() должен быть реализован в дочернем классе');
  }

  /**
   * Получение данных графика
   * @param {Object} params - Параметры запроса
   * @param {string} params.symbol - Символ торговой пары
   * @param {string} [params.interval='1h'] - Интервал свечей
   * @param {number} [params.limit=100] - Максимальное количество свечей
   * @param {number} [params.endTime] - Время окончания
   * @param {string} [params.marketType='spot'] - Тип рынка ('spot' или 'futures')
   * @returns {Promise<Array>} - Массив свечей
   */
  async getChartData(params = {}) {
    throw new Error('Метод getChartData() должен быть реализован в дочернем классе');
  }

  /**
   * Получение текущей цены для торговой пары
   * @param {string} symbol - Символ торговой пары
   * @returns {Promise<Object>} - Информация о текущей цене
   */
  async getTicker(symbol) {
    throw new Error('Метод getTicker() должен быть реализован в дочернем классе');
  }

  /**
   * Получение списка доступных торговых пар
   * @param {string} [marketType='spot'] - Тип рынка
   * @returns {Promise<Array>} - Список торговых пар
   */
  async getTradingPairs(marketType = 'spot') {
    throw new Error('Метод getTradingPairs() должен быть реализован в дочернем классе');
  }

  /**
   * Получение списка доступных фьючерсных торговых пар
   * @param {string} [productType='umcbl'] - Тип контракта (например, 'umcbl' — USDT-margined perpetual)
   * @returns {Promise<Array>} - Список фьючерсных пар
   */
  async getFuturesTradingPairs(productType = 'umcbl') {
    throw new Error('Метод getFuturesTradingPairs() должен быть реализован в дочернем классе');
  }

  /**
   * Получение открытых ордеров
   * @param {string} [symbol] - Символ торговой пары
   * @returns {Promise<Array>} - Список открытых ордеров
   */
  async getOpenOrders(symbol = null) {
    throw new Error('Метод getOpenOrders() должен быть реализован в дочернем классе');
  }

  /**
   * Создание ордера
   * @param {string} symbol - Символ торговой пары
   * @param {string} side - Сторона (BUY/SELL)
   * @param {string} type - Тип ордера (LIMIT/MARKET/STOP)
   * @param {number} quantity - Количество
   * @param {number} [price] - Цена (для LIMIT-ордеров)
   * @returns {Promise<Object>} - Информация о созданном ордере
   */
  async createOrder(symbol, side, type, quantity, price = null) {
    throw new Error('Метод createOrder() должен быть реализован в дочернем классе');
  }

  /**
   * Отмена ордера
   * @param {string} symbol - Символ торговой пары
   * @param {string} orderId - ID ордера
   * @returns {Promise<Object>} - Информация об отмененном ордере
   */
  async cancelOrder(symbol, orderId) {
    throw new Error('Метод cancelOrder() должен быть реализован в дочернем классе');
  }

  /**
   * Подписка на обновления свечей в реальном времени
   * @param {string} symbol - Символ торговой пары
   * @param {string} interval - Интервал свечей
   * @param {Function} callback - Функция обратного вызова для обработки данных
   * @returns {string|null} - Идентификатор подписки или null в случае ошибки
   */
  subscribeToKlineStream(symbol, interval, callback) {
    throw new Error('Метод subscribeToKlineStream() должен быть реализован в дочернем классе');
  }

  /**
   * Отписка от потока данных
   * @param {string} streamName - Имя потока или идентификатор подписки
   * @returns {boolean} - Результат операции
   */
  unsubscribeFromStream(streamName) {
    throw new Error('Метод unsubscribeFromStream() должен быть реализован в дочернем классе');
  }
}

module.exports = ExchangeConnectorInterface;
