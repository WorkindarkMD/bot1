import apiClient from '../api/apiClient';

const statusService = {
  getStatus: () => {
    return apiClient.get('/api/status');
  }
};

export default statusService;