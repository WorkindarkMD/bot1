// redux/reducers.js - Редьюсеры Redux

// Начальное состояние
const initialState = {
  // Системные данные
    isLoading: false,
  error: null,
  status: null,
  settings: null,
  exchanges: [],
  exchange: 'bitget', // правильное значение
  marketType: 'spot',
  pairs: [], // уже правильно, массив
  currentPair: 'BTCUSDT',
  interval: '1h',
  darkMode: true,
  language: 'ru',
  
  // Данные графика
  chartData: [],
  indicators: [],
  indicatorsVisualData: [],
  
  // Данные AI-анализатора
  isAnalyzing: false,
  analysisResult: null,
  
  // Позиции
  positions: [],
  positionHistory: [],
  
  // Сигналы
  signals: [],
  
  // Копитрейдинг
  traders: [],
  copyTradingMonitors: [],
  
  // Аналитика
  analyticsData: null,
  
  // Smart Grid
  activeGrids: [],
  gridHistory: []
};

/**
 * Корневой редьюсер
 * @param {Object} state - Текущее состояние
 * @param {Object} action - Действие
 * @returns {Object} - Новое состояние
 */
const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    // Системные действия
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    
    case 'SET_SYSTEM_STATUS':
      return {
        ...state,
        status: action.payload
      };
    
    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload
      };
    
    case 'SET_EXCHANGES':
      return {
        ...state,
        exchanges: action.payload
      };
    
    case 'SET_EXCHANGE':
      return {
        ...state,
        exchange: action.payload
      };
    
    case 'SET_MARKET_TYPE':
      return {
        ...state,
        marketType: action.payload
      };
    
    case 'SET_PAIRS':
      return {
        ...state,
        pairs: action.payload
      };
    
    case 'SET_TRADING_PAIR':
      return {
        ...state,
        currentPair: action.payload
      };
    
    case 'SET_INTERVAL':
      return {
        ...state,
        interval: action.payload
      };
    
    case 'SET_DARK_MODE':
      return {
        ...state,
        darkMode: action.payload
      };
    
    case 'SET_LANGUAGE':
      return {
        ...state,
        language: action.payload
      };
    
    // Действия графика
    case 'SET_CHART_DATA':
      return {
        ...state,
        chartData: action.payload
      };
    
    case 'SET_INDICATORS':
      return {
        ...state,
        indicators: action.payload
      };
    
    case 'SET_INDICATORS_VISUAL_DATA':
      return {
        ...state,
        indicatorsVisualData: action.payload
      };
    
    // Действия AI-анализатора
    case 'SET_ANALYZING':
      return {
        ...state,
        isAnalyzing: action.payload
      };
    
    case 'SET_ANALYSIS_RESULT':
      return {
        ...state,
        analysisResult: action.payload
      };
    
    // Действия позиций
    case 'SET_POSITIONS':
      return {
        ...state,
        positions: action.payload
      };
    
    case 'SET_POSITION_HISTORY':
      return {
        ...state,
        positionHistory: action.payload
      };
    
    // Действия сигналов
    case 'SET_SIGNALS':
      return {
        ...state,
        signals: action.payload
      };
    
    case 'ADD_SIGNAL':
      return {
        ...state,
        signals: [action.payload, ...state.signals]
      };
    
    // Действия копитрейдинга
    case 'SET_TRADERS':
      return {
        ...state,
        traders: action.payload
      };
    
    case 'SET_COPY_TRADING_MONITORS':
      return {
        ...state,
        copyTradingMonitors: action.payload
      };
    
    // Действия аналитики
    case 'SET_ANALYTICS_DATA':
      return {
        ...state,
        analyticsData: action.payload
      };
    
    // Действия Smart Grid
    case 'SET_ACTIVE_GRIDS':
      return {
        ...state,
        activeGrids: action.payload
      };
    
    case 'SET_GRID_HISTORY':
      return {
        ...state,
        gridHistory: action.payload
      };
    
    // Инициализация состояния из WebSocket
    case 'SET_INITIAL_STATE':
      return {
        ...state,
        ...action.payload
      };
    
    default:
      return state;
  }
};

export default rootReducer;