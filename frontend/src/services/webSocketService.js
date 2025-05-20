// webSocketService.js - Исправленная версия с улучшенной обработкой сообщений
import { WS_URL } from './apiConfig';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3 секунды
    this.subscribers = new Map();
    this.connected = false;
    this.messageQueue = [];
    this.lastPingTime = 0;
    this.pingInterval = null;
    this.connecting = false; // Флаг для отслеживания процесса подключения
  }

  /**
   * Подключение к WebSocket
   * @returns {Promise<boolean>} - Статус подключения
   */
  connect() {
    // Если мы уже в процессе подключения, возвращаем существующий промис
    if (this.connecting) {
      console.log('WebSocket подключение уже в процессе, ожидаем...');
      return this.connectionPromise;
    }

    // Если уже подключены, просто возвращаем успех
    if (this.socket && this.connected) {
      console.log('WebSocket уже подключен');
      return Promise.resolve(true);
    }

    // Устанавливаем флаг подключения и создаем промис
    this.connecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log(`Подключение к WebSocket: ${WS_URL}`);
        this.socket = new WebSocket(WS_URL);

        // Устанавливаем таймаут на подключение
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            console.error('Превышено время ожидания подключения к WebSocket');
            this.socket.close();
            this.connecting = false;
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 секунд таймаут

        this.socket.onopen = () => {
          console.log('WebSocket connected');
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          
          // Запускаем пинг для поддержания соединения
          this.startPingInterval();
          
          // Отправляем сообщения из очереди
          this.processMessageQueue();
          
          // Запрашиваем начальное состояние
          this.send({ type: 'GET_INITIAL_STATE' });
          
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(connectionTimeout);
          this.connecting = false;
          if (!this.connected) {
            reject(error);
          }
        };

        this.socket.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          clearTimeout(connectionTimeout);
          this.stopPingInterval();
          this.connected = false;
          this.connecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        this.connecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Начать отправку периодических пингов
   */
  startPingInterval() {
    this.stopPingInterval(); // Сначала останавливаем предыдущий интервал, если он был
    
    this.lastPingTime = Date.now();
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        try {
          this.send({ type: 'PING', timestamp: Date.now() });
          this.lastPingTime = Date.now();
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, 30000); // пинг каждые 30 секунд
  }

  /**
   * Остановить отправку периодических пингов
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Отправка сообщения через WebSocket
   * @param {Object} data - Данные для отправки
   * @returns {boolean} - Статус отправки
   */
  send(data) {
    // Если соединение не установлено, добавляем сообщение в очередь
    if (!this.socket || !this.connected) {
      console.log('WebSocket не подключен, добавляем сообщение в очередь:', data.type || 'unknown');
      this.messageQueue.push(data);
      // Если не подключаемся, инициируем подключение
      if (!this.connecting) {
        this.connect().catch(err => console.error('Не удалось подключиться:', err));
      }
      return false;
    }

    // Проверяем, готов ли сокет к отправке
    if (this.socket.readyState !== WebSocket.OPEN) {
      console.log(`WebSocket не готов для отправки (состояние: ${this.socket.readyState}), добавляем сообщение в очередь:`, data.type || 'unknown');
      this.messageQueue.push(data);
      return false;
    }

    try {
      const message = JSON.stringify(data);
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Ошибка при отправке сообщения WebSocket:', error);
      this.messageQueue.push(data);
      return false;
    }
  }

  /**
   * Обработка входящего сообщения
   * @param {MessageEvent} event - Событие сообщения
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Обрабатываем специальные сообщения
      if (data.type === 'PONG') {
        console.log('Received PONG from server');
        return;
      }
      
      // Оповещаем подписчиков
      if (data.type) {
        const subscribers = this.subscribers.get(data.type) || [];
        subscribers.forEach(callback => {
          try {
            callback(data.payload || data);
          } catch (err) {
            console.error(`Error in subscriber callback for ${data.type}:`, err);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Попытка переподключения при обрыве соединения
   */
  attemptReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('connection_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)); // Экспоненциальная задержка
    
    console.log(`Attempting to reconnect in ${delay / 1000} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnect attempt failed:', err);
        this.attemptReconnect();
      });
    }, delay);
  }

  /**
   * Отправка события всем подписчикам определенного типа
   * @param {string} type - Тип события
   * @param {Object} [data={}] - Данные события
   */
  emit(type, data = {}) {
    const subscribers = this.subscribers.get(type) || [];
    subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`Error in subscriber callback for ${type}:`, err);
      }
    });
  }

  /**
   * Обработка очереди сообщений после повторного подключения
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const messagesToSend = [...this.messageQueue];
    this.messageQueue = [];
    
    messagesToSend.forEach(message => {
      this.send(message);
    });
  }

  /**
   * Подписка на определенный тип сообщений
   * @param {string} type - Тип сообщения
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} - Функция для отписки
   */
  subscribe(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }

    const subscribers = this.subscribers.get(type);
    subscribers.push(callback);

    return () => {
      const index = subscribers.indexOf(callback);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Отписка от всех сообщений определенного типа
   * @param {string} type - Тип сообщения
   */
  unsubscribeAll(type) {
    this.subscribers.delete(type);
  }

  /**
   * Закрытие соединения
   */
  disconnect() {
    this.stopPingInterval();
    
    if (this.socket) {
      // Отправляем сервера уведомление о закрытии
      if (this.connected) {
        try {
          this.socket.send(JSON.stringify({ type: 'DISCONNECT' }));
        } catch (e) {
          console.error('Error sending disconnect message', e);
        }
      }
      
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.connected = false;
    this.connecting = false;
    this.subscribers.clear();
    this.messageQueue = [];
    
    console.log('WebSocket disconnected by client');
  }

  /**
   * Получение начального состояния
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} - Функция для отписки
   */
  getInitialState(callback) {
    // Проверяем, что callback - это функция
    if (typeof callback !== 'function') {
      console.error('getInitialState requires a callback function');
      return;
    }
    
    // Подписываемся на событие INITIAL_STATE
    const unsubscribe = this.subscribe('INITIAL_STATE', callback);
    
    // Надежная отправка запроса на получение начального состояния
    this.connect()
      .then(() => {
        this.send({ type: 'GET_INITIAL_STATE' });
      })
      .catch(err => {
        console.error('Failed to connect to WebSocket:', err);
      });
    
    return unsubscribe;
  }

  /**
   * Установка торговой пары
   * @param {string} pair - Торговая пара
   * @returns {boolean} - Результат отправки
   */
  setTradingPair(pair) {
    return this.send({ 
      type: 'SET_TRADING_PAIR', 
      payload: { pair } 
    });
  }

  /**
   * Установка биржи
   * @param {string} exchange - Название биржи
   * @returns {boolean} - Результат отправки
   */
  setExchange(exchange) {
    return this.send({ 
      type: 'SET_EXCHANGE', 
      payload: { exchange } 
    });
  }

  /**
   * Подписка на обновления графика в реальном времени
   * @param {string} symbol - Символ торговой пары
   * @param {string} interval - Интервал графика
   * @param {Function} callback - Функция обратного вызова для обновлений
   * @returns {Function} - Функция для отписки
   */
  subscribeToChart(symbol, interval, callback) {
    // Подписываемся на обновления
    const unsubscribe = this.subscribe('CHART_UPDATE', (data) => {
      // Проверяем, что данные относятся к нужной паре и интервалу
      if (data.symbol === symbol && data.interval === interval) {
        callback(data.candle || data);
      }
    });
    
    // Отправляем запрос на подписку
    this.connect()
      .then(() => {
        this.send({ 
          type: 'SUBSCRIBE_TO_CHART', 
          payload: { symbol, interval } 
        });
      })
      .catch(err => {
        console.error('Failed to connect for chart subscription:', err);
      });
    
    return unsubscribe;
  }

  /**
   * Подписка на обновления позиций
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} - Функция для отписки
   */
  subscribeToPositions(callback) {
    const unsubscribe = this.subscribe('POSITIONS_UPDATE', callback);
    
    this.connect()
      .then(() => {
        this.send({ type: 'SUBSCRIBE_TO_POSITIONS' });
      })
      .catch(err => {
        console.error('Failed to connect for positions subscription:', err);
      });
    
    return unsubscribe;
  }

  /**
   * Подписка на сигналы
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} - Функция для отписки
   */
  subscribeToSignals(callback) {
    const unsubscribe = this.subscribe('SIGNAL_RECEIVED', callback);
    
    this.connect()
      .then(() => {
        this.send({ type: 'SUBSCRIBE_TO_SIGNALS' });
      })
      .catch(err => {
        console.error('Failed to connect for signals subscription:', err);
      });
    
    return unsubscribe;
  }

  /**
   * Подписка на Smart Grid
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} - Функция для отписки
   */
  subscribeToSmartGrid(callback) {
    const unsubscribe = this.subscribe('SMART_GRID_UPDATE', callback);
    
    this.connect()
      .then(() => {
        this.send({ type: 'SUBSCRIBE_TO_SMART_GRID' });
      })
      .catch(err => {
        console.error('Failed to connect for smart grid subscription:', err);
      });
    
    return unsubscribe;
  }
}

// Создаем экземпляр сервиса
const webSocketService = new WebSocketService();

// Добавляем в window для облегчения доступа из других модулей
window.webSocketService = webSocketService;

export default webSocketService;