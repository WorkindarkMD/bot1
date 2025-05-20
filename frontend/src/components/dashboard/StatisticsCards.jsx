import React from 'react';
import { TrendingUp, CreditCard, Activity, DollarSign } from 'lucide-react';
import Card from '../common/Card';

/**
 * Компонент с карточками статистики для дашборда
 * @param {Object} props - Свойства компонента
 * @param {Object} props.stats - Статистические данные
 */
const StatisticsCards = ({ stats = {} }) => {
  // Значения по умолчанию, если данные не переданы
  const {
    balance = 10245,
    balanceChange = 890,
    profit = 23.5,
    profitChange = 5.2,
    positions = 5,
    longPositions = 3,
    shortPositions = 2,
    signals = 7,
    highConfidenceSignals = 5
  } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <Card padding="normal" className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 text-sm">Баланс</p>
            <h2 className="text-2xl font-bold mt-1">${balance}</h2>
          </div>
          <div className="bg-blue-500/20 p-3 rounded-lg">
            <DollarSign size={20} className="text-blue-400" />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <span className="text-green-400 text-sm flex items-center">
            <TrendingUp size={12} className="mr-1" /> +${balanceChange}
          </span>
          <span className="text-gray-500 text-sm ml-2">за 24ч</span>
        </div>
      </Card>
      
      <Card padding="normal" className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 text-sm">Прибыль</p>
            <h2 className="text-2xl font-bold mt-1">+{profit}%</h2>
          </div>
          <div className="bg-green-500/20 p-3 rounded-lg">
            <TrendingUp size={20} className="text-green-400" />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <span className="text-green-400 text-sm flex items-center">
            <TrendingUp size={12} className="mr-1" /> +{profitChange}%
          </span>
          <span className="text-gray-500 text-sm ml-2">за 7 дней</span>
        </div>
      </Card>
      
      <Card padding="normal" className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 text-sm">Открытые позиции</p>
            <h2 className="text-2xl font-bold mt-1">{positions}</h2>
          </div>
          <div className="bg-purple-500/20 p-3 rounded-lg">
            <Activity size={20} className="text-purple-400" />
          </div>
        </div>
        <div className="mt-4 flex items-center">
          <span className="text-green-400 text-sm">{longPositions} LONG</span>
          <span className="text-red-400 text-sm ml-2">{shortPositions} SHORT</span>
        </div>
      </Card>
      
      <Card padding="normal" className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 text-sm">Активные сигналы</p>
            <h2 className="text-2xl font-bold mt-1">{signals}</h2>
          </div>
          <div className="bg-yellow-500/20 p-3 rounded-lg">
            <CreditCard size={20} className="text-yellow-400" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-blue-400 text-sm">
          <span>{highConfidenceSignals} высокая уверенность</span>
        </div>
      </Card>
    </div>
  );
};

export default StatisticsCards;