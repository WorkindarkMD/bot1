// Action Types
export const LOAD_CHART_DATA_REQUEST = 'LOAD_CHART_DATA_REQUEST';
export const LOAD_CHART_DATA_SUCCESS = 'LOAD_CHART_DATA_SUCCESS';
export const LOAD_CHART_DATA_FAILURE = 'LOAD_CHART_DATA_FAILURE';

/**
 * Action creator for loading chart data
 * @param {string} pair - Trading pair (e.g., 'BTCUSDT')
 * @param {string} interval - Chart timeframe (e.g., '1h', '1d')
 * @returns {Function} - Thunk function that dispatches actions
 */
export const loadChartData = (pair, interval) => {
  return async (dispatch, getState) => {
    try {
      // Dispatch request action
      dispatch({ 
        type: LOAD_CHART_DATA_REQUEST,
        payload: { pair, interval }
      });
      
      // Note: We're not actually fetching data here since your component
      // is already doing that with the fetchChartData function from useApi.
      // This action is just for tracking the state in Redux.
      
      // If you want to handle the API call here instead, you could do:
      // const response = await fetch(`/api/chart?pair=${pair}&interval=${interval}`);
      // const data = await response.json();
      // dispatch({ type: LOAD_CHART_DATA_SUCCESS, payload: data });
      
    } catch (error) {
      dispatch({ 
        type: LOAD_CHART_DATA_FAILURE, 
        payload: { error: error.message } 
      });
    }
  };
};

// You can add more action creators here as needed