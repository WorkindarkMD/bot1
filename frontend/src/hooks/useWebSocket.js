import { useEffect, useCallback } from 'react';
import api from '../api';

const useWebSocket = (type, callback) => {
  const subscribe = useCallback(() => {
    return api.websocket.subscribe(type, callback);
  }, [type, callback]);

  useEffect(() => {
    // Подписка на события
    const unsubscribe = subscribe();
    
    // Отписка при размонтировании
    return () => {
      unsubscribe();
    };
  }, [subscribe]);
};

export default useWebSocket;