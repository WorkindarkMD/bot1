// Основные экшены Redux для платформы

// Статус загрузки
export const setLoading = (isLoading) => ({
  type: 'SET_LOADING',
  payload: isLoading,
});

// Ошибка
export const setError = (error) => ({
  type: 'SET_ERROR',
  payload: error,
});

// Статус системы
export const setSystemStatus = (status) => ({
  type: 'SET_SYSTEM_STATUS',
  payload: status,
});

// Настройки
export const setSettings = (settings) => ({
  type: 'SET_SETTINGS',
  payload: settings,
});

// Биржа
export const setExchange = (exchange) => ({
  type: 'SET_EXCHANGE',
  payload: exchange,
});

// Тип рынка
export const setMarketType = (marketType) => ({
  type: 'SET_MARKET_TYPE',
  payload: marketType,
});

// Торговые пары
export const setPairs = (pairs) => ({
  type: 'SET_PAIRS',
  payload: pairs,
});

export const setCurrentPair = (pair) => ({
  type: 'SET_CURRENT_PAIR',
  payload: pair,
});

export const setInterval = (interval) => ({
  type: 'SET_INTERVAL',
  payload: interval,
});

// Данные графика
export const setChartData = (data) => ({
  type: 'SET_CHART_DATA',
  payload: data,
});

export const setIndicators = (indicators) => ({
  type: 'SET_INDICATORS',
  payload: indicators,
});

// Позиции
export const setPositions = (positions) => ({
  type: 'SET_POSITIONS',
  payload: positions,
});

export const setPositionHistory = (history) => ({
  type: 'SET_POSITION_HISTORY',
  payload: history,
});

// Сигналы
export const setSignals = (signals) => ({
  type: 'SET_SIGNALS',
  payload: signals,
});

// Аналитика
export const setAnalysisResult = (result) => ({
  type: 'SET_ANALYSIS_RESULT',
  payload: result,
});

export const setAnalyticsData = (data) => ({
  type: 'SET_ANALYTICS_DATA',
  payload: data,
});

// Трейдеры
export const setTraders = (traders) => ({
  type: 'SET_TRADERS',
  payload: traders,
});

// Гриды
export const setActiveGrids = (grids) => ({
  type: 'SET_ACTIVE_GRIDS',
  payload: grids,
});

export const setGridHistory = (history) => ({
  type: 'SET_GRID_HISTORY',
  payload: history,
});
