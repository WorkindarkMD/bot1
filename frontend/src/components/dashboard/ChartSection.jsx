import React, { useEffect } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import Card from '../common/Card';
import Loader from '../common/Loader';

/**
 * Компонент с графиком для дашборда
 * @param {Object} props - Свойства компонента
 * @param {Array} props.chartData - Данные для графика
 * @param {boolean} props.isLoading - Флаг загрузки
 * @param {Function} props.onRefresh - Функция обновления данных
 */
const ChartSection = ({ chartData = [], isLoading = false, onRefresh }) => {
  // Имитация подключения к графику после монтирования компонента
  useEffect(() => {
    if (chartData.length > 0 && !isLoading) {
      initializeChart();
    }
  }, [chartData, isLoading]);

  /**
   * Инициализация графика (в реальном приложении здесь будет код создания графика)
   */
  const initializeChart = () => {
    // В реальном приложении здесь будет код инициализации графика
    console.log('Инициализация графика с данными:', chartData);
  };

  /**
   * Обработчик обновления графика
   */
  const handleRefresh = () => {
    if (onRefresh && typeof onRefresh === 'function') {
      onRefresh();
    }
  };

  return (
    <Card 
      className="mb-6" 
      padding="small"
      actions={
        <button 
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm flex items-center"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      }
    >
      {isLoading ? (
        <div className="h-96 w-full flex justify-center items-center">
          <Loader size="lg" text="Загрузка данных графика..." />
        </div>
      ) : chartData && chartData.length > 0 ? (
        <div className="chart-container h-96">
          {/* В реальном приложении здесь будет компонент графика */}
          <div className="w-full h-full bg-gray-750 flex items-center justify-center">
            <div className="text-center">
              <TrendingUp size={40} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">График BTC/USDT (1h)</p>
              <p className="text-sm text-gray-500">Демо-версия графика</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-96 w-full flex items-center justify-center">
          <div className="text-center">
            <TrendingUp size={60} className="mx-auto text-gray-700 mb-4" />
            <p className="text-xl text-gray-500">Данные графика не загружены</p>
            <p className="text-gray-600 mt-2">Нажмите "Обновить" для загрузки данных</p>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ChartSection;