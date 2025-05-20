import React, { useState, useEffect, forwardRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AlertCircle, CheckCircle, X, BellRing, Info } from 'lucide-react';

/**
 * Компонент для отображения уведомлений
 */
const Notification = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const userInfo = useSelector(state => state.user);
  const error = useSelector(state => state.error);
  
  const [notifications, setNotifications] = useState([]);
  const [visible, setVisible] = useState(false);
  
  // Добавление уведомления об ошибке, если она появляется
  useEffect(() => {
    if (error) {
      addNotification({
        type: 'error',
        message: error.message || 'Произошла ошибка',
        description: error.action ? `При выполнении: ${error.action}` : undefined,
        autoClose: true
      });
      
      // Очищаем ошибку в Redux
      dispatch({ type: 'CLEAR_ERROR' });
    }
  }, [error, dispatch]);
  
  /**
   * Добавление нового уведомления
   * @param {Object} notification - Уведомление
   * @param {string} notification.type - Тип уведомления ('success', 'error', 'info', 'warning')
   * @param {string} notification.message - Сообщение
   * @param {string} notification.description - Описание (опционально)
   * @param {boolean} notification.autoClose - Автоматическое закрытие (опционально)
   */
  const addNotification = (notification) => {
    const id = Date.now().toString();
    const newNotification = {
      id,
      ...notification,
      timestamp: new Date()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setVisible(true);
    
    // Если нужно автоматическое закрытие
    if (notification.autoClose) {
      const timeout = notification.type === 'error' ? 10000 : 5000; // Ошибки показываем дольше
      
      setTimeout(() => {
        removeNotification(id);
      }, timeout);
    }
  };
  
  /**
   * Удаление уведомления
   * @param {string} id - ID уведомления
   */
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Если больше нет уведомлений, скрываем панель
    if (notifications.length <= 1) {
      setVisible(false);
    }
  };
  
  /**
   * Получение иконки в зависимости от типа уведомления
   * @param {string} type - Тип уведомления
   * @returns {JSX.Element} - Иконка
   */
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="text-green-400" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-400" />;
      case 'warning':
        return <AlertCircle size={20} className="text-yellow-400" />;
      case 'info':
      default:
        return <Info size={20} className="text-blue-400" />;
    }
  };
  
  /**
   * Получение цвета фона в зависимости от типа уведомления
   * @param {string} type - Тип уведомления
   * @returns {string} - Класс цвета
   */
  const getBackgroundColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 border-green-500/30';
      case 'error':
        return 'bg-red-500/20 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/30';
      case 'info':
      default:
        return 'bg-blue-500/20 border-blue-500/30';
    }
  };
  
  /**
   * Форматирование времени
   * @param {Date} date - Дата
   * @returns {string} - Отформатированное время
   */
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Если нет уведомлений или панель скрыта, не рендерим
  if (!visible || notifications.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed top-20 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] space-y-2">
      {notifications.map(notification => (
        <div 
          key={notification.id}
          className={`${getBackgroundColor(notification.type)} border rounded-lg shadow-lg p-4 animate-slideIn`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-start">
              <div className="mt-0.5 mr-3">
                {getIcon(notification.type)}
              </div>
              <div>
                <div className="font-medium">{notification.message}</div>
                {notification.description && (
                  <div className="text-sm mt-1 text-gray-300">{notification.description}</div>
                )}
                <div className="text-xs mt-2 text-gray-400">{formatTime(notification.timestamp)}</div>
              </div>
            </div>
            <button 
              className="text-gray-400 hover:text-white p-1"
              onClick={() => removeNotification(notification.id)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

// Добавляем метод addNotification к компоненту для доступа через ref
Notification.displayName = 'Notification';

/**
 * Компонент для работы с уведомлениями через контекст
 */
export const NotificationProvider = ({ children }) => {
  const notificationRef = React.useRef(null);
  
  // Функция для добавления уведомления
  const notify = (notification) => {
    if (notificationRef.current && notificationRef.current.addNotification) {
      notificationRef.current.addNotification(notification);
    }
  };
  
  // Делаем функцию доступной глобально
  React.useEffect(() => {
    window.notify = notify;
    
    return () => {
      delete window.notify;
    };
  }, []);
  
  return (
    <>
      <Notification ref={notificationRef} />
      {children}
    </>
  );
};

export default Notification;