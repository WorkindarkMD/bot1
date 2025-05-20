import api from '../api';
import { 
  setLoading, 
  setError, 
  setSystemStatus, 
  setSettings, 
  setExchange,
  setMarketType,
  setPairs,
  setCurrentPair,
  setInterval,
  setChartData,
  setIndicators,
  setPositions,
  setPositionHistory,
  setSignals,
  setAnalysisResult,
  setTraders,
  setActiveGrids,
  setGridHistory,
  setAnalyticsData
} from '../store/actions';

// Статус системы
export const fetchSystemStatus = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const status = await api.status.getStatus();
    dispatch(setSystemStatus(status));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Настройки
export const fetchSettings = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const settings = await api.settings.getSettings();
    dispatch(setSettings(settings));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateSettings = (settings) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const updatedSettings = await api.settings.saveSettings(settings);
    dispatch(setSettings(updatedSettings));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Биржи и пары
export const changeExchange = (exchange) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    dispatch(setExchange(exchange));
    
    // После смены биржи обновляем список пар
    dispatch(fetchPairs(exchange));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const changePair = (pair) => async (dispatch) => {
  dispatch(setCurrentPair(pair));
};

export const changeInterval = (interval) => async (dispatch) => {
  dispatch(setInterval(interval));
};

export const fetchPairs = (exchange, type = 'futures', productType) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const response = await api.chart.getPairs(exchange, type, productType);
    const pairs = response?.data || response?.pairs || response || [];
    dispatch(setPairs(pairs));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// График и индикаторы
export const fetchChartData = (pair, interval) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const data = await api.chart.getChartData(pair, interval);
    dispatch(setChartData(data));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchIndicators = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const indicators = await api.chart.getIndicators();
    dispatch(setIndicators(indicators));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const toggleIndicator = (indicator, enabled) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.chart.toggleIndicator(indicator, enabled);
    dispatch(fetchIndicators());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const analyzeChart = (params) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const result = await api.chart.analyzeChart(params);
    dispatch(setAnalysisResult(result));
    return result;
  } catch (error) {
    dispatch(setError(error.message));
    return null;
  } finally {
    dispatch(setLoading(false));
  }
};

// Позиции
export const fetchPositions = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const positions = await api.trading.getPositions();
    dispatch(setPositions(positions));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchPositionHistory = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const history = await api.trading.getPositionHistory();
    dispatch(setPositionHistory(history));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const openPosition = (positionData) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.trading.openPosition(positionData);
    dispatch(fetchPositions());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const closePosition = (positionId) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.trading.closePosition(positionId);
    dispatch(fetchPositions());
    dispatch(fetchPositionHistory());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Сигналы
export const fetchSignals = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const signals = await api.trading.getSignals();
    dispatch(setSignals(signals));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const executeSignal = (signalId) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.trading.executeSignal(signalId);
    dispatch(fetchSignals());
    dispatch(fetchPositions());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Копитрейдинг
export const fetchTraders = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const traders = await api.copyTrading.getTraders();
    dispatch(setTraders(traders));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const startCopyTrading = (params) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.copyTrading.startCopyTrading(params);
    // Обновляем список копируемых трейдеров
    const monitors = await api.copyTrading.getCopiedTraders();
    // В реальном приложении здесь был бы dispatch для обновления стейта
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const stopCopyTrading = (monitorId) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.copyTrading.stopCopyTrading(monitorId);
    // Обновляем список копируемых трейдеров
    const monitors = await api.copyTrading.getCopiedTraders();
    // В реальном приложении здесь был бы dispatch для обновления стейта
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Smart Grid
export const fetchActiveGrids = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const grids = await api.grid.getGrids();
    dispatch(setActiveGrids(grids));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const fetchGridHistory = () => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const history = await api.grid.getGridHistory();
    dispatch(setGridHistory(history));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const createGrid = (gridData) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.grid.createGrid(gridData);
    dispatch(fetchActiveGrids());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

export const closeGrid = (gridId) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    await api.grid.closeGrid(gridId);
    dispatch(fetchActiveGrids());
    dispatch(fetchGridHistory());
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};

// Аналитика
export const fetchAnalyticsData = (period) => async (dispatch) => {
  dispatch(setLoading(true));
  try {
    const data = await api.analytics.getAnalytics(period);
    dispatch(setAnalyticsData(data));
  } catch (error) {
    dispatch(setError(error.message));
  } finally {
    dispatch(setLoading(false));
  }
};