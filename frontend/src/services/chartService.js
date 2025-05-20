import apiClient from '../api/apiClient';

const chartService = {
  getChartData: (pair, interval, limit = 100, endTime = null) => {
    const params = { pair, interval, limit };
    if (endTime) params.endTime = endTime;
    
    return apiClient.get('/api/chart', { params });
  },
  
  getIndicators: () => {
    return apiClient.get('/api/indicators');
  },
  
  toggleIndicator: (indicator, enabled) => {
    return apiClient.post('/api/indicators/toggle', { indicator, enabled });
  },
  
  analyzeChart: (params) => {
    return apiClient.post('/api/chart/analyze', params);
  }
};

chartService.getPairs = (exchange, type, productType) => {
  const params = { exchange, type };
  if (type === 'futures' && exchange === 'bitget' && productType) {
    params.productType = productType;
  }
  return apiClient.get('/api/pairs', { params });
};

export default chartService;