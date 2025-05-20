import CONFIG from './config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket соединение уже установлено или устанавливается');
      return;
    }

    console.log('Устанавливаем WebSocket соединение...');
    this.socket = new WebSocket(CONFIG.WS_URL);
    
    this.socket.onopen = () => {
      console.log('WebSocket соединение установлено');
      this.reconnectAttempts = 0;
      this.send({ type: 'GET_INITIAL_STATE' });
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket получено сообщение:', data);
        
        if (this.callbacks[data.type]) {
          this.callbacks[data.type].forEach(callback => callback(data.payload));
        }
      } catch (error) {
        console.error('Ошибка при обработке WebSocket сообщения:', error);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket ошибка:', error);
    };
    
    this.socket.onclose = (event) => {
      console.log(`WebSocket соединение закрыто: ${event.code} ${event.reason}`);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${this.reconnectDelay}мс`);
        setTimeout(() => this.connect(), this.reconnectDelay);
      } else {
        console.error('Превышено максимальное количество попыток переподключения');
      }
    };
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      console.log('WebSocket соединение закрыто');
    }
  }
  
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket не подключен, невозможно отправить сообщение');
      this.connect();
      setTimeout(() => this.send(message), 500);
    }
  }
  
  subscribe(type, callback) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
    
    return () => {
      this.callbacks[type] = this.callbacks[type].filter(cb => cb !== callback);
    };
  }
}

export default new WebSocketService();