import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  BarChart2, PieChart, TrendingUp, Calendar, 
  CreditCard, DollarSign, BarChart, LineChart, Activity, 
  Download, Filter, ChevronDown
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import Card from '../common/Card';
import Loader from '../common/Loader';
import EmptyState from '../common/EmptyState';
import useApi from '../../hooks/useApi';

const AnalyticsContent = () => {
  const analyticsData = useSelector(state => state.analyticsData);
  const isLoading = useSelector(state => state.isLoading);
  const { fetchAnalyticsData } = useApi();
  
  const [period, setPeriod] = useState('30d');
  const [activeSection, setActiveSection] = useState('overview');
  
  // Для демонстрации создаем примерные данные
  const demoAnalyticsData = {
    overview: {
      totalProfit: 1250.75,
      profitPercent: 18.2,
      totalTrades: 78,
      winRate: 68,
      profitFactor: 2.4,
      avgTradeProfit: 16.03,
      avgTradeDuration: '16h 24m',
      bestTrade: {
        pair: 'SOL/USDT',
        profit: 185.5,
        profitPercent: 37.1,
        date: '2023-04-10'
      },
      worstTrade: {
        pair: 'DOGE/USDT',
        profit: -65.3,
        profitPercent: -12.4,
        date: '2023-04-02'
      }
    },
    performance: {
      daily: [
        { date: '2023-04-01', profit: 45.2, trades: 3 },
        { date: '2023-04-02', profit: -12.3, trades: 2 },
        { date: '2023-04-03', profit: 0, trades: 0 },
        { date: '2023-04-04', profit: 78.5, trades: 4 },
        { date: '2023-04-05', profit: 32.1, trades: 2 },
        { date: '2023-04-06', profit: -25.6, trades: 3 },
        { date: '2023-04-07', profit: 0, trades: 0 },
        { date: '2023-04-08', profit: 15.3, trades: 1 },
        { date: '2023-04-09', profit: 92.7, trades: 5 },
        { date: '2023-04-10', profit: 185.5, trades: 2 },
        { date: '2023-04-11', profit: -8.4, trades: 1 },
        { date: '2023-04-12', profit: 48.6, trades: 3 },
        { date: '2023-04-13', profit: 63.2, trades: 4 },
        { date: '2023-04-14', profit: 0, trades: 0 },
      ],
      cumulative: [
        { date: '2023-04-01', value: 45.2 },
        { date: '2023-04-02', value: 32.9 },
        { date: '2023-04-03', value: 32.9 },
        { date: '2023-04-04', value: 111.4 },
        { date: '2023-04-05', value: 143.5 },
        { date: '2023-04-06', value: 117.9 },
        { date: '2023-04-07', value: 117.9 },
        { date: '2023-04-08', value: 133.2 },
        { date: '2023-04-09', value: 225.9 },
        { date: '2023-04-10', value: 411.4 },
        { date: '2023-04-11', value: 403.0 },
        { date: '2023-04-12', value: 451.6 },
        { date: '2023-04-13', value: 514.8 },
        { date: '2023-04-14', value: 514.8 },
      ]
    },
    distribution: {
      byPair: [
        { name: 'BTC/USDT', value: 420.5 },
        { name: 'ETH/USDT', value: 280.3 },
        { name: 'SOL/USDT', value: 312.7 },
        { name: 'XRP/USDT', value: 86.5 },
        { name: 'AVAX/USDT', value: 95.2 },
        { name: 'Other', value: 55.5 }
      ],
      bySource: [
        { name: 'AI-анализ', value: 540.8 },
        { name: 'Копитрейдинг', value: 385.2 },
        { name: 'Smart Grid', value: 245.5 },
        { name: 'Ручная торговля', value: 79.2 }
      ],
      byDirection: [
        { name: 'LONG', value: 840.3 },
        { name: 'SHORT', value: 410.45 }
      ]
    },
    riskMetrics: {
      drawdown: {
        maxAbsolute: 145.8,
        maxPercent: 6.8,
        current: 0
      },
      sharpeRatio: 1.75,
      sortinoRatio: 2.12,
      riskRewardRatio: 2.4,
      volatility: 5.2
    }
  };
  
  // Загрузка данных при изменении периода или монтировании
  useEffect(() => {
    // Используем параметр период только при реальном API запросе, в демо-режиме просто имитируем задержку
    fetchAnalyticsData({ period });
  }, [period, fetchAnalyticsData]);
  
  // Обработчики
  const handleChangePeriod = (newPeriod) => {
    setPeriod(newPeriod);
    // Перезагружаем аналитические данные с новым периодом
    fetchAnalyticsData({ period: newPeriod });
  };
  
  // Цвета для графиков
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  
  // Форматирование чисел
  const formatCurrency = (value) => {
    return `$${value.toFixed(2)}`;
  };
  
  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };
  
  // Рендер обзорных метрик
  const renderOverview = () => {
    const data = demoAnalyticsData.overview;
    
    if (isLoading) {
      return <Loader text="Загрузка метрик..." />;
    }
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="small" className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                <DollarSign size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Общая прибыль</p>
                <p className="text-lg font-semibold text-white">${data.totalProfit.toFixed(2)}</p>
                <p className="text-xs text-green-400">+{data.profitPercent}%</p>
              </div>
            </div>
          </Card>
          
          <Card padding="small" className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                <CreditCard size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Всего сделок</p>
                <p className="text-lg font-semibold text-white">{data.totalTrades}</p>
              </div>
            </div>
          </Card>
          
          <Card padding="small" className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
                <Activity size={20} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Win Rate</p>
                <p className="text-lg font-semibold text-white">{data.winRate}%</p>
              </div>
            </div>
          </Card>
          
          <Card padding="small" className="p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
                <BarChart2 size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Profit Factor</p>
                <p className="text-lg font-semibold text-white">{data.profitFactor}</p>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Вклад в прибыль по инструментам">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demoAnalyticsData.distribution.byPair}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {demoAnalyticsData.distribution.byPair.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          <Card title="Вклад по источникам сигналов">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demoAnalyticsData.distribution.bySource}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {demoAnalyticsData.distribution.bySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Лучшие и худшие сделки">
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="font-medium text-green-400 mb-2">Лучшая сделка</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium">{data.bestTrade.pair}</div>
                    <div className="text-sm text-gray-400">{data.bestTrade.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium text-green-400">${data.bestTrade.profit.toFixed(2)}</div>
                    <div className="text-sm text-green-400">+{data.bestTrade.profitPercent}%</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="font-medium text-red-400 mb-2">Худшая сделка</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-medium">{data.worstTrade.pair}</div>
                    <div className="text-sm text-gray-400">{data.worstTrade.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium text-red-400">${data.worstTrade.profit.toFixed(2)}</div>
                    <div className="text-sm text-red-400">{data.worstTrade.profitPercent}%</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          
          <Card title="Дополнительные метрики">
            <div className="divide-y divide-gray-700">
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Средняя прибыль на сделку</span>
                <span className="font-medium">${data.avgTradeProfit}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Среднее время сделки</span>
                <span className="font-medium">{data.avgTradeDuration}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Максимальная просадка</span>
                <span className="font-medium text-red-400">-${demoAnalyticsData.riskMetrics.drawdown.maxAbsolute} ({demoAnalyticsData.riskMetrics.drawdown.maxPercent}%)</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Коэффициент Шарпа</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.sharpeRatio}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Коэффициент Сортино</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.sortinoRatio}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };
  
  // Рендер графиков производительности
  const renderPerformance = () => {
    if (isLoading) {
      return <Loader text="Загрузка метрик..." />;
    }
    
    const daily = demoAnalyticsData.performance.daily;
    const cumulative = demoAnalyticsData.performance.cumulative;
    
    return (
      <div className="space-y-6">
        <Card title="Ежедневная P&L">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={daily}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip formatter={(value) => [`$${value}`, 'Прибыль/Убыток']} />
                <Legend />
                <Bar 
                  dataKey="profit" 
                  name="P&L" 
                  fill="#3B82F6" 
                  isAnimationActive={true}
                  shape={(props) => {
                    const { x, y, width, height, profit } = props;
                    return (
                      <rect 
                        x={x} 
                        y={profit >= 0 ? y : y - height} 
                        width={width} 
                        height={Math.abs(height)} 
                        fill={profit >= 0 ? '#10B981' : '#EF4444'} 
                        radius={[2, 2, 0, 0]}
                      />
                    );
                  }}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <Card title="Кумулятивная P&L">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={cumulative}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip formatter={(value) => [`$${value}`, 'Кумулятивная P&L']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Кумулятивная P&L"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={true}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Распределение по направлению">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demoAnalyticsData.distribution.byDirection}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#EF4444" />
                  </Pie>
                  <Tooltip formatter={formatCurrency} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          
          <Card title="Метрики риска">
            <div className="divide-y divide-gray-700">
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Максимальная просадка</span>
                <span className="font-medium text-red-400">-${demoAnalyticsData.riskMetrics.drawdown.maxAbsolute} ({demoAnalyticsData.riskMetrics.drawdown.maxPercent}%)</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Соотношение риск/доходность</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.riskRewardRatio}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Коэффициент Шарпа</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.sharpeRatio}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Коэффициент Сортино</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.sortinoRatio}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-400">Волатильность</span>
                <span className="font-medium">{demoAnalyticsData.riskMetrics.volatility}%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-6 w-full h-full overflow-y-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Торговая аналитика</h1>
          <p className="text-gray-400">Детальная аналитика вашей торговой деятельности</p>
        </div>
        <div className="flex space-x-2">
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center">
            <Download size={16} className="mr-2" />
            Экспорт
          </button>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center">
            <Filter size={16} className="mr-2" />
            Настройки
          </button>
        </div>
      </div>
      
      {/* Селектор периода */}
      <div className="mb-6 flex space-x-2">
        <button 
          className={`px-4 py-2 rounded-lg ${period === '7d' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => handleChangePeriod('7d')}
        >
          7 дней
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${period === '30d' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => handleChangePeriod('30d')}
        >
          30 дней
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${period === '90d' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => handleChangePeriod('90d')}
        >
          90 дней
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${period === '1y' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => handleChangePeriod('1y')}
        >
          1 год
        </button>
        <button 
          className={`px-4 py-2 rounded-lg ${period === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => handleChangePeriod('all')}
        >
          Все время
        </button>
      </div>
      
      {/* Селектор секции */}
      <div className="mb-6 flex space-x-2">
        <button 
          className={`px-4 py-2 rounded-lg flex items-center ${activeSection === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => setActiveSection('overview')}
        >
          <BarChart2 size={16} className="mr-2" />
          Обзор
        </button>
        <button 
          className={`px-4 py-2 rounded-lg flex items-center ${activeSection === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          onClick={() => setActiveSection('performance')}
        >
          <LineChart size={16} className="mr-2" />
          Производительность
        </button>
      </div>
      
      {/* Основной контент */}
      {activeSection === 'overview' ? renderOverview() : renderPerformance()}
    </div>
  );
};

export default AnalyticsContent;