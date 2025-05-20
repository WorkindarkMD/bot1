import apiClient from '../api/apiClient';

const tradingService = {
  getPositions: () => {
    return apiClient.get('/api/positions');
  },
  
  getPositionHistory: () => {
    return apiClient.get('/api/positions/history');
  },
  
  openPosition: (positionData) => {
    return apiClient.post('/api/positions', positionData);
  },
  
  closePosition: (positionId) => {
    return apiClient.post(`/api/positions/${positionId}/close`);
  },
  
  getSignals: () => {
    return apiClient.get('/api/signals');
  },
  
  executeSignal: (signalId) => {
    return apiClient.post(`/api/signals/${signalId}/execute`);
  }
};

export default tradingService;