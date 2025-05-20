import apiClient from '../api/apiClient';

const gridService = {
  getGrids: () => {
    return apiClient.get('/api/grids');
  },
  
  getGridHistory: () => {
    return apiClient.get('/api/grids/history');
  },
  
  createGrid: (gridData) => {
    return apiClient.post('/api/grids', gridData);
  },
  
  closeGrid: (gridId) => {
    return apiClient.post(`/api/grids/${gridId}/close`);
  }
};

export default gridService;