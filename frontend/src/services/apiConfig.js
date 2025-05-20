// apiConfig.js - Базовая конфигурация для API

// Базовый URL для API запросов
export const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:4000' 
  : window.location.origin;

// В apiConfig.js добавьте новый путь API для BitGet
export const API_PATHS = {
  // ...ваши существующие пути

  STATUS: '/api/status',
  SETTINGS: '/api/settings',
  EXCHANGES: '/api/exchanges',
  PAIRS: '/api/pairs',
  CHART: '/api/chart',
  ORDERS: '/api/orders',
  MODULES: '/api/modules',

  CHART_INDICATORS_VISIBLE: '/api/chart/indicators/visible',


  // Индикаторы
  INDICATORS: '/api/indicators',
  INDICATORS_VISUAL_DATA: '/api/indicators/visual-data/all',
   INDICATOR_DATA: '/api/chart/indicator',

  // Управление графиком
  CHART_INFO: '/api/chart/info',
  CHART_SYMBOL: '/api/chart/symbol',
  CHART_INTERVAL: '/api/chart/interval',
  CHART_THEME: '/api/chart/theme',

  // AI-анализатор
  AI_ANALYZER: '/api/modules/ai-analyzer/analyze',
  AI_METADATA: '/api/modules/ai-analyzer/metadata',
  AI_SCREENSHOTS: '/api/modules/ai-analyzer/screenshots',
  AI_AUTO_START: '/api/modules/ai-analyzer/start-auto',
  AI_AUTO_STOP: '/api/modules/ai-analyzer/stop-auto',
  AI_AUTO_TASKS: '/api/modules/ai-analyzer/auto-tasks',
  AI_JOBS: '/api/modules/ai-analyzer/jobs',

  // Автотрейдер
  EXECUTE_SIGNAL: '/api/execute-signal',
  ACTIVE_POSITIONS: '/api/positions/active',
  POSITIONS_HISTORY: '/api/positions/history',
  CLOSE_POSITION: '/api/close-position',
  TRADING_STATS: '/api/trading-stats',

  // Копитрейдинг
  COPY_TRADING_EXCHANGES: '/api/copy-trading/exchanges',
  COPY_TRADING_TRADERS: '/api/copy-trading/traders',
  COPY_TRADING_START_MONITORING: '/api/copy-trading/start-monitoring',
  COPY_TRADING_STOP_MONITORING: '/api/copy-trading/stop-monitoring',
  COPY_TRADING_MONITORS: '/api/copy-trading/monitors',

  // Интеграция копитрейдинга с AI
  COPY_TRADING_AI_ENHANCE: '/api/copy-trading-ai/enhance-signal',
  COPY_TRADING_AI_CONFIRM: '/api/copy-trading-ai/confirm-signal',
  COPY_TRADING_AI_START: '/api/copy-trading-ai/start-integration',
  COPY_TRADING_AI_STOP: '/api/copy-trading-ai/stop-integration',
  COPY_TRADING_AI_INTEGRATIONS: '/api/copy-trading-ai/integrations',
  COPY_TRADING_AI_CONFIG: '/api/copy-trading-ai/config',

  // Торговая аналитика
  ANALYTICS_DATA: '/api/analytics/data',
  ANALYTICS_DAILY_STATS: '/api/analytics/daily-stats',

  // Adaptive Smart Grid
  SMART_GRID_CREATE: '/api/adaptive-grid/create',
  SMART_GRID_ACTIVE: '/api/adaptive-grid/active',
  SMART_GRID_HISTORY: '/api/adaptive-grid/history',
  SMART_GRID_DETAILS: '/api/adaptive-grid',
  SMART_GRID_CLOSE: '/api/adaptive-grid',
  SMART_GRID_CONFIG: '/api/adaptive-grid/config'
};

// WebSocket URL
export const WS_URL = process.env.NODE_ENV === 'development' 
  ? 'ws://localhost:4000' 
  : (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

// Форматы данных
export const DATA_FORMATS = {
  // Таймфреймы для графиков
  INTERVALS: ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'],
  
  // Типы рынков
  MARKET_TYPES: ['spot', 'futures']
};

// Настройки запросов по умолчанию
export const DEFAULT_REQUEST_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  },
  mode: 'cors',
  credentials: 'same-origin',
  timeout: 30000
};

// Функция для построения URL с параметрами
export const buildUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}${path}`);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  return url.toString();
};