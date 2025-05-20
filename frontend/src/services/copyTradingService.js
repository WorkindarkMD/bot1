import apiClient from '../api/apiClient';

const copyTradingService = {
  getTraders: () => {
    return apiClient.get('/api/traders');
  },
  
  getTraderById: (traderId) => {
    return apiClient.get(`/api/traders/${traderId}`);
  },
  
  startCopyTrading: (params) => {
    return apiClient.post('/api/copy-trading/start', params);
  },
  
  stopCopyTrading: (monitorId) => {
    return apiClient.post(`/api/copy-trading/${monitorId}/stop`);
  },
  
  getCopiedTraders: () => {
    return apiClient.get('/api/copy-trading/monitors');
  }
};

export default copyTradingService;