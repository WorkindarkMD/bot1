import { useDispatch } from 'react-redux';
import * as actionCreators from '../redux/actionCreators';
import api from '../api';

const useApi = () => {
  const dispatch = useDispatch();
  
  return {
    // Статус и настройки
    fetchSystemStatus: () => dispatch(actionCreators.fetchSystemStatus()),
    fetchSettings: () => dispatch(actionCreators.fetchSettings()),
    updateSettings: (settings) => dispatch(actionCreators.updateSettings(settings)),
    
    // Управление биржей и парами
    changeExchange: (exchange) => dispatch(actionCreators.changeExchange(exchange)),
    changePair: (pair) => dispatch(actionCreators.changePair(pair)),
    changeInterval: (interval) => dispatch(actionCreators.changeInterval(interval)),
    fetchPairs: (exchange, type) => dispatch(actionCreators.fetchPairs(exchange, type)),
    
    // Работа с графиком
    fetchChartData: (pair, interval) => dispatch(actionCreators.fetchChartData(pair, interval)),
    fetchIndicators: () => dispatch(actionCreators.fetchIndicators()),
    toggleIndicator: (indicator, enabled) => dispatch(actionCreators.toggleIndicator(indicator, enabled)),
    analyzeChart: (params) => dispatch(actionCreators.analyzeChart(params)),
    
    // Управление позициями
    fetchPositions: () => dispatch(actionCreators.fetchPositions()),
    fetchPositionHistory: () => dispatch(actionCreators.fetchPositionHistory()),
    openPosition: (positionData) => dispatch(actionCreators.openPosition(positionData)),
    closePosition: (positionId) => dispatch(actionCreators.closePosition(positionId)),
    
    // Работа с сигналами
    fetchSignals: () => dispatch(actionCreators.fetchSignals()),
    executeSignal: (signalId) => dispatch(actionCreators.executeSignal(signalId)),
    
    // Копитрейдинг
    fetchTraders: () => dispatch(actionCreators.fetchTraders()),
    startCopyTrading: (params) => dispatch(actionCreators.startCopyTrading(params)),
    stopCopyTrading: (monitorId) => dispatch(actionCreators.stopCopyTrading(monitorId)),
    
    // Smart Grid
    fetchActiveGrids: () => dispatch(actionCreators.fetchActiveGrids()),
    fetchGridHistory: () => dispatch(actionCreators.fetchGridHistory()),
    createGrid: (gridData) => dispatch(actionCreators.createGrid(gridData)),
    closeGrid: (gridId) => dispatch(actionCreators.closeGrid(gridId)),
    
    // Аналитика
    fetchAnalyticsData: (period) => dispatch(actionCreators.fetchAnalyticsData(period)),
    // Методы из apiService
    checkConnection: api.checkConnection,
    initializeAppData: api.initializeAppData
  }
};

export default useApi;