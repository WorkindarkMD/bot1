import apiClient from '../api/apiClient';

const settingsService = {
  getSettings: () => {
    return apiClient.get('/api/settings');
  },
  
  saveSettings: (settings) => {
    return apiClient.post('/api/settings', settings);
  }
};

export default settingsService;