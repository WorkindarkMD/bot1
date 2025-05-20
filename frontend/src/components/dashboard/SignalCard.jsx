import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import Card from '../common/Card';

/**
 * Компонент карточки торгового сигнала для дашборда
 * @param {Object} props - Свойства компонента
 * @param {Object} props.signal - Данные сигнала
 * @param {boolean} props.isAnalyzing - Флаг процесса анализа
 * @param {boolean} props.showSignal - Флаг отображения сигнала
 * @param {Function} props.onAnalyze - Функция запуска анализа
 * @param {Function} props.onExecute - Функция исполнения сигнала
 */
const SignalCard = ({ 
  signal = null, 
  isAnalyzing = false, 
  showSignal = false,
  onAnalyze,
  onExecute
}) => {
  // Демо-данные анализа, если сигнал не передан
  const analysisResult = signal || {
    confidence: 89,
    direction: 'LONG',
    entryPoint: '42,350 - 42,420',
    stopLoss: '41,200',
    takeProfit1: '43,500',
    takeProfit2: '45,200',
    riskReward: '1:3.8'
  };

  /**
   * Обработчик клика по кнопке анализа
   */
  const handleAnalyze = () => {
    if (onAnalyze && typeof onAnalyze === 'function') {
      onAnalyze();
    }
  };

  /**
   * Обработчик клика по кнопке исполнения сигнала
   */
  const handleExecute = () => {
    if (onExecute && typeof onExecute === 'function') {
      onExecute(analysisResult);
    }
  };

  return (
    <Card 
      title="Торговый сигнал"
      className="mb-6"
    >
      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-400">Формирование сигнала...</p>
        </div>
      ) : showSignal ? (
        <>
          <div className="mb-4 text-center">
            <div className={`inline-block w-full py-3 text-lg font-medium ${
              analysisResult.direction === 'SELL' || analysisResult.direction === 'SHORT'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-green-500/20 text-green-400'
            } rounded-lg`}>
              {analysisResult.direction}
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Вход:</span>
              <span className="font-medium">${analysisResult.entryPoint}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Стоп-лосс:</span>
              <span className="font-medium text-red-400">${analysisResult.stopLoss}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-700">
              <span className="text-gray-400">Тейк-профит:</span>
              <span className="font-medium text-green-400">${analysisResult.takeProfit2}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">R/R:</span>
              <span className="font-medium text-yellow-400">{analysisResult.riskReward}</span>
            </div>
          </div>
          
          <button 
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center"
            onClick={handleExecute}
          >
            <Zap size={18} className="mr-2" />
            Исполнить сигнал
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <p>Сигнал пока не сформирован</p>
          <button
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
            onClick={handleAnalyze}
          >
            <Zap size={16} className="mr-2" />
            Анализировать
          </button>
        </div>
      )}
    </Card>
  );
};

export default SignalCard;