import apiClient from './apiClient';
import websocketService from './websocketService';
import statusService from './services/statusService';
import settingsService from './services/settingsService';
import chartService from './services/chartService';
import tradingService from './services/tradingService';
import copyTradingService from './services/copyTradingService';
import gridService from './services/gridService';
import analyticsService from './services/analyticsService';
import apiService from '../services/apiService'; // Добавляем импорт apiService

const api = {
  websocket: websocketService,
  status: statusService,
  settings: settingsService,
  chart: chartService,
  trading: tradingService,
  copyTrading: copyTradingService,
  grid: gridService,
  analytics: analyticsService,
  checkConnection: () => apiService.checkConnection(),
  initializeAppData: () => apiService.initializeAppData(),
};

export default api;