import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { AlertTriangle, DollarSign, Percent, Zap, Shield, Save, RefreshCw } from 'lucide-react';
import Card from './common/Card';
import useApi from '../hooks/useApi';

/**
 * Компонент настройки риск-менеджмента
 */
const RiskManagement = ({ onClose }) => {
  const settings = useSelector(state => state.settings);
  const { updateSettings, analyzeChart } = useApi();
  
  // Состояние настроек риск-менеджмента
  const [riskSettings, setRiskSettings] = useState({
    positionSize: 2, // % от баланса
    maxPositions: 5, // Максимальное количество одновременных позиций
    maxLeverage: 5, // Максимальное плечо
    stopLossPercent: 2, // % для стоп-лосса
    takeProfitRatio: 3, // Соотношение TP:SL
    useAiRiskManagement: true, // Использовать AI для риск-менеджмента
    aiConfidenceThreshold: 75, // Минимальная уверенность AI для открытия позиции
    trailingStop: false, // Использовать трейлинг-стоп
    confirmBeforeExecution: true // Требовать подтверждения перед исполнением
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  
  // Загрузка настроек из Redux
  useEffect(() => {
    if (settings && settings.riskManagement) {
      setRiskSettings(prev => ({
        ...prev,
        ...settings.riskManagement
      }));
    }
  }, [settings]);
  
  /**
   * Обработчик изменения настроек
   * @param {string} field - Название поля
   * @param {any} value - Новое значение
   */
  const handleChange = (field, value) => {
    setRiskSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  /**
   * Сохранение настроек
   */
  const saveSettings = async () => {
    setIsLoading(true);
    
    try {
      // Обновляем настройки
      const updatedSettings = {
        ...settings,
        riskManagement: riskSettings
      };
      
      await updateSettings(updatedSettings);
      
      // Показываем сообщение об успешном сохранении
      if (window.notify) {
        window.notify({
          type: 'success',
          message: 'Настройки риск-менеджмента сохранены',
          autoClose: true
        });
      }
      
      // Закрываем модальное окно, если оно есть
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
      if (window.notify) {
        window.notify({
          type: 'error',
          message: 'Ошибка при сохранении настроек',
          description: error.message,
          autoClose: true
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Получение рекомендаций AI
   */
  const getAiRecommendations = async () => {
    setIsLoading(true);
    
    try {
      // Получение анализа текущего рынка
      const analysisParams = {
        riskAnalysis: true // Специальный флаг для анализа риск-менеджмента
      };
      
      // Анализируем рынок
      const result = await analyzeChart(analysisParams);
      
      // Если есть результат, устанавливаем рекомендации
      if (result && result.riskRecommendations) {
        setAiRecommendation(result.riskRecommendations);
      } else {
        if (window.notify) {
          window.notify({
            type: 'warning',
            message: 'Не удалось получить рекомендации',
            description: 'AI не смог предоставить рекомендации по риск-менеджменту для текущего рынка',
            autoClose: true
          });
        }
      }
    } catch (error) {
      console.error('Ошибка при получении рекомендаций:', error);
      if (window.notify) {
        window.notify({
          type: 'error',
          message: 'Ошибка при получении рекомендаций',
          description: error.message,
          autoClose: true
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Применение рекомендаций AI
   */
  const applyAiRecommendations = () => {
    if (!aiRecommendation) return;
    
    // Применяем рекомендации к настройкам
    setRiskSettings(prev => ({
      ...prev,
      positionSize: aiRecommendation.positionSize || prev.positionSize,
      maxLeverage: aiRecommendation.maxLeverage || prev.maxLeverage,
      stopLossPercent: aiRecommendation.stopLossPercent || prev.stopLossPercent,
      takeProfitRatio: aiRecommendation.takeProfitRatio || prev.takeProfitRatio
    }));
    
    if (window.notify) {
      window.notify({
        type: 'success',
        message: 'Рекомендации AI применены',
        autoClose: true
      });
    }
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Настройки риск-менеджмента</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="p-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mr-3">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Параметры риска</h3>
                <p className="text-sm text-gray-400">Основные настройки управления рисками</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Размер позиции (% от баланса)</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    min="0.1" 
                    max="10" 
                    step="0.1" 
                    value={riskSettings.positionSize} 
                    onChange={(e) => handleChange('positionSize', parseFloat(e.target.value))} 
                    className="w-full mr-2" 
                  />
                  <span className="w-12 text-center">{riskSettings.positionSize}%</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Максимум одновременных позиций</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={riskSettings.maxPositions} 
                    onChange={(e) => handleChange('maxPositions', parseInt(e.target.value))} 
                    className="w-full mr-2" 
                  />
                  <span className="w-12 text-center">{riskSettings.maxPositions}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Максимальное кредитное плечо</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={riskSettings.maxLeverage} 
                    onChange={(e) => handleChange('maxLeverage', parseInt(e.target.value))} 
                    className="w-full mr-2" 
                  />
                  <span className="w-12 text-center">{riskSettings.maxLeverage}x</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="p-4">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                <Percent size={20} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Прибыль и убытки</h3>
                <p className="text-sm text-gray-400">Настройки стоп-лосс и тейк-профит</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Стоп-лосс (% от цены входа)</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    min="0.5" 
                    max="10" 
                    step="0.5" 
                    value={riskSettings.stopLossPercent} 
                    onChange={(e) => handleChange('stopLossPercent', parseFloat(e.target.value))} 
                    className="w-full mr-2" 
                  />
                  <span className="w-12 text-center">{riskSettings.stopLossPercent}%</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Соотношение Take Profit / Stop Loss</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="0.5" 
                    value={riskSettings.takeProfitRatio} 
                    onChange={(e) => handleChange('takeProfitRatio', parseFloat(e.target.value))} 
                    className="w-full mr-2" 
                  />
                  <span className="w-12 text-center">{riskSettings.takeProfitRatio}:1</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <label className="text-sm">Использовать трейлинг-стоп</label>
                <div 
                  className={`relative inline-block w-12 h-6 rounded-full ${riskSettings.trailingStop ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
                  onClick={() => handleChange('trailingStop', !riskSettings.trailingStop)}
                >
                  <div className={`absolute ${riskSettings.trailingStop ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <Zap size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium">AI-улучшение риск-менеджмента</h3>
              <p className="text-sm text-gray-400">Использовать ИИ для оптимизации параметров риска</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm">Использовать AI для риск-менеджмента</label>
            <div 
              className={`relative inline-block w-12 h-6 rounded-full ${riskSettings.useAiRiskManagement ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
              onClick={() => handleChange('useAiRiskManagement', !riskSettings.useAiRiskManagement)}
            >
              <div className={`absolute ${riskSettings.useAiRiskManagement ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
            </div>
          </div>
          
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Минимальная уверенность AI для открытия позиции</label>
            <div className="flex items-center">
              <input 
                type="range" 
                min="50" 
                max="95" 
                step="5" 
                value={riskSettings.aiConfidenceThreshold} 
                onChange={(e) => handleChange('aiConfidenceThreshold', parseInt(e.target.value))} 
                className="w-full mr-2" 
                disabled={!riskSettings.useAiRiskManagement}
              />
              <span className="w-12 text-center">{riskSettings.aiConfidenceThreshold}%</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm">Требовать подтверждения перед исполнением</label>
            <div 
              className={`relative inline-block w-12 h-6 rounded-full ${riskSettings.confirmBeforeExecution ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
              onClick={() => handleChange('confirmBeforeExecution', !riskSettings.confirmBeforeExecution)}
            >
              <div className={`absolute ${riskSettings.confirmBeforeExecution ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
            </div>
          </div>
          
          {aiRecommendation && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-blue-400 mb-2">Рекомендации AI:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Рекомендуемый размер позиции:</span>
                  <span className="font-medium">{aiRecommendation.positionSize}%</span>
                </li>
                <li className="flex justify-between">
                  <span>Рекомендуемое плечо:</span>
                  <span className="font-medium">{aiRecommendation.maxLeverage}x</span>
                </li>
                <li className="flex justify-between">
                  <span>Рекомендуемый стоп-лосс:</span>
                  <span className="font-medium">{aiRecommendation.stopLossPercent}%</span>
                </li>
                <li className="flex justify-between">
                  <span>Рекомендуемое соотношение TP/SL:</span>
                  <span className="font-medium">{aiRecommendation.takeProfitRatio}:1</span>
                </li>
              </ul>
              <div className="mt-3">
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm"
                  onClick={applyAiRecommendations}
                >
                  Применить рекомендации
                </button>
              </div>
            </div>
          )}
          
          <div>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
              onClick={getAiRecommendations}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Получение рекомендаций...
                </>
              ) : (
                <>
                  <Zap size={16} className="mr-2" />
                  Получить рекомендации AI
                </>
              )}
            </button>
          </div>
        </div>
      </Card>
      
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <Shield size={20} className="text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-yellow-400 mb-1">Важное примечание о риске</h4>
            <p className="text-sm text-gray-300">
              Торговля криптовалютами сопряжена с высоким риском. Никогда не инвестируйте больше, чем вы готовы потерять. 
              Настройки риск-менеджмента помогают контролировать потенциальные убытки, но не гарантируют их предотвращение.
              Даже с AI-улучшением, рекомендуется осуществлять торговлю осознанно.
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button 
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
          onClick={saveSettings}
          disabled={isLoading}
        >
          <Save size={16} className="mr-2" />
          {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
};

export default RiskManagement;