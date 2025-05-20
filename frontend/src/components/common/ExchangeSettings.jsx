import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Key, AlertCircle, Shield, CheckCircle, Save } from 'lucide-react';
import Card from './common/Card';
import useApi from '../hooks/useApi';

/**
 * Компонент для настройки подключений к биржам
 */
const ExchangeSettings = ({ onClose }) => {
  const exchanges = useSelector(state => state.exchanges);
const exchange = useSelector(state => state.exchange);
const settings = useSelector(state => state.settings);
  const { updateSettings } = useApi();
  
  const [activeExchange, setActiveExchange] = useState(exchange || 'binance');
  const [apiKeys, setApiKeys] = useState({});
  const [testStatus, setTestStatus] = useState({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Инициализация API ключей из настроек
  useEffect(() => {
    if (settings && settings.apiKeys) {
      setApiKeys(settings.apiKeys);
    } else {
      // Если настроек нет, создаем пустые поля для каждой биржи
      const initialKeys = {};
      exchanges.forEach(exch => {
        initialKeys[exch] = { apiKey: '', secretKey: '' };
      });
      setApiKeys(initialKeys);
    }
  }, [settings, exchanges]);
  
  /**
   * Обработчик изменения ключа API
   * @param {string} exchange - Биржа
   * @param {string} keyType - Тип ключа ('apiKey' или 'secretKey')
   * @param {string} value - Значение ключа
   */
  const handleKeyChange = (exchange, keyType, value) => {
    setApiKeys(prev => ({
      ...prev,
      [exchange]: {
        ...prev[exchange],
        [keyType]: value
      }
    }));
    
    // Сбрасываем статус проверки при изменении ключей
    setTestStatus(prev => ({
      ...prev,
      [exchange]: null
    }));
  };
  
  /**
   * Проверка подключения к бирже
   * @param {string} exchange - Биржа для проверки
   */
  const testConnection = async (exchange) => {
    setIsTesting(true);
    setTestStatus(prev => ({
      ...prev,
      [exchange]: 'testing'
    }));
    
    try {
      // В реальном приложении здесь будет вызов API для проверки подключения
      // Имитируем задержку и случайный результат для демонстрации
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Имитация результата проверки (в реальном приложении будет результат от API)
      const isSuccess = Math.random() > 0.3; // 70% шанс успешного подключения
      
      setTestStatus(prev => ({
        ...prev,
        [exchange]: isSuccess ? 'success' : 'error'
      }));
    } catch (error) {
      setTestStatus(prev => ({
        ...prev,
        [exchange]: 'error'
      }));
    } finally {
      setIsTesting(false);
    }
  };
  
  /**
   * Сохранение настроек
   */
  const saveSettings = async () => {
    setIsSaving(true);
    
    try {
      // Обновляем настройки
      const updatedSettings = {
        ...settings,
        apiKeys
      };
      
      await updateSettings(updatedSettings);
      
      // Показываем сообщение об успешном сохранении
      alert('Настройки успешно сохранены');
      
      // Закрываем модальное окно, если оно есть
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      alert('Ошибка при сохранении настроек');
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Рендер статуса подключения
   * @param {string} status - Статус подключения
   * @returns {JSX.Element} - Элемент статуса
   */
  const renderStatus = (status) => {
    switch (status) {
      case 'testing':
        return (
          <div className="flex items-center text-blue-400">
            <div className="animate-spin mr-1">⟳</div>
            <span>Проверка...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-400">
            <CheckCircle size={16} className="mr-1" />
            <span>Подключено</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-400">
            <AlertCircle size={16} className="mr-1" />
            <span>Ошибка подключения</span>
          </div>
        );
      default:
        return (
          <div className="text-gray-400">
            Не проверено
          </div>
        );
    }
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Настройки подключения к биржам</h2>
      
      <div className="mb-6">
        <div className="flex space-x-2 mb-4">
          {['bitget'].map(exch => (
            <button
              key={exch}
              className={`px-4 py-2 rounded-lg capitalize ${
                activeExchange === exch 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => setActiveExchange(exch)}
            >
              {exch}
            </button>
          ))}
        </div>
        
        {['bitget'].map(exch => (
          <div key={exch} className={activeExchange === exch ? 'block' : 'hidden'}>
            <Card>
              <div className="p-4">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                    <Key size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium capitalize">{exch}</h3>
                    <p className="text-sm text-gray-400">Настройка API ключей для {exch}</p>
                  </div>
                </div>
                
                <div className="bg-gray-700/30 p-4 rounded-lg mb-4">
                  <div className="flex items-start">
                    <Shield size={16} className="text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-gray-300">
                      Ваши API ключи безопасно хранятся локально и используются только для подключения к {exch}. 
                      Рекомендуется использовать ключи с ограниченными правами (только чтение и торговля).
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">API Key</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500" 
                      placeholder="Введите API ключ"
                      value={apiKeys[exch]?.apiKey || ''}
                      onChange={(e) => handleKeyChange(exch, 'apiKey', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Secret Key</label>
                    <input 
                      type="password" 
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500" 
                      placeholder="Введите секретный ключ"
                      value={apiKeys[exch]?.secretKey || ''}
                      onChange={(e) => handleKeyChange(exch, 'secretKey', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>{renderStatus(testStatus[exch])}</div>
                  
                  <button 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                    onClick={() => testConnection(exch)}
                    disabled={isTesting || !apiKeys[exch]?.apiKey || !apiKeys[exch]?.secretKey}
                  >
                    Проверить подключение
                  </button>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
      
      <div className="flex justify-end">
        <button 
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
          onClick={saveSettings}
          disabled={isSaving}
        >
          <Save size={16} className="mr-2" />
          {isSaving ? 'Сохранение...' : 'Сохранить все настройки'}
        </button>
      </div>
    </div>
  );
};

export default ExchangeSettings;