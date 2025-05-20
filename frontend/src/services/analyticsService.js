import apiClient from '../api/apiClient';

const analyticsService = {
  getAnalytics: (period = '30d') => {
    return apiClient.get('/api/analytics', { params: { period } });
  }
};

export default analyticsService;