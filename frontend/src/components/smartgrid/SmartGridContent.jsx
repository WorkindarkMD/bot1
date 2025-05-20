import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  Grid, 
  ChevronRight, 
  Zap, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  PlusCircle,
  Clock // Add missing Clock import
} from 'lucide-react';
import Card from '../common/Card'; // Fix import to use default export
import Loader from '../common/Loader'; // Fix import to use default export
import StatusBadge from '../common/StatusBadge'; // Fix import to use default export
import EmptyState from '../common/EmptyState'; // Fix import to use default export
import useApi from '../../hooks/useApi';

const SmartGridContent = () => {
  const activeGrids = useSelector(state => state.adaptiveGrid.activeGrids);
const gridHistory = useSelector(state => state.adaptiveGrid.gridHistory);
const isLoading = useSelector(state => state.adaptiveGrid.isLoading);
  const { fetchActiveGrids, fetchGridHistory, createGrid, closeGrid } = useApi();
  
  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGrid, setSelectedGrid] = useState(null);
  const [expandedGridId, setExpandedGridId] = useState(null);
  
  // Для демонстрации создаем примерные сетки
  const demoGrids = [
    {
      id: 'grid_1',
      pair: 'BTC/USDT',
      direction: 'BUY',
      status: 'ACTIVE',
      startPrice: 42500,
      upperLimit: 45000,
      lowerLimit: 40000,
      gridLevels: 10,
      totalInvestment: 1000,
      currentProfit: 45.8,
      profitPercent: 4.58,
      createdTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 2,
      updatedTime: new Date().getTime() - 1000 * 60 * 15,
      orders: [
        { price: 44500, status: 'FILLED', amount: 0.0224, side: 'SELL', profit: 10.8 },
        { price: 44000, status: 'FILLED', amount: 0.0227, side: 'SELL', profit: 9.2 },
        { price: 43500, status: 'FILLED', amount: 0.0229, side: 'SELL', profit: 8.9 },
        { price: 43000, status: 'FILLED', amount: 0.0232, side: 'SELL', profit: 7.5 },
        { price: 42500, status: 'OPEN', amount: 0.0235, side: 'SELL', profit: 0 },
        { price: 42000, status: 'OPEN', amount: 0.0238, side: 'BUY', profit: 0 },
        { price: 41500, status: 'OPEN', amount: 0.0240, side: 'BUY', profit: 0 },
        { price: 41000, status: 'FILLED', amount: 0.0243, side: 'BUY', profit: 4.1 },
        { price: 40500, status: 'FILLED', amount: 0.0246, side: 'BUY', profit: 5.3 },
        { price: 40000, status: 'OPEN', amount: 0.0250, side: 'BUY', profit: 0 }
      ]
    },
    {
      id: 'grid_2',
      pair: 'ETH/USDT',
      direction: 'NEUTRAL',
      status: 'ACTIVE',
      startPrice: 2800,
      upperLimit: 3200,
      lowerLimit: 2400,
      gridLevels: 8,
      totalInvestment: 800,
      currentProfit: 24.2,
      profitPercent: 3.03,
      createdTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 1,
      updatedTime: new Date().getTime() - 1000 * 60 * 30,
      orders: [
        { price: 3200, status: 'OPEN', amount: 0.25, side: 'SELL', profit: 0 },
        { price: 3100, status: 'OPEN', amount: 0.258, side: 'SELL', profit: 0 },
        { price: 3000, status: 'FILLED', amount: 0.266, side: 'SELL', profit: 6.8 },
        { price: 2900, status: 'FILLED', amount: 0.275, side: 'SELL', profit: 7.3 },
        { price: 2800, status: 'OPEN', amount: 0.285, side: 'SELL', profit: 0 },
        { price: 2700, status: 'OPEN', amount: 0.296, side: 'BUY', profit: 0 },
        { price: 2600, status: 'FILLED', amount: 0.307, side: 'BUY', profit: 5.1 },
        { price: 2500, status: 'FILLED', amount: 0.32, side: 'BUY', profit: 5 }
      ]
    },
    {
      id: 'grid_3',
      pair: 'SOL/USDT',
      direction: 'SELL',
      status: 'COMPLETED',
      startPrice: 80,
      upperLimit: 90,
      lowerLimit: 70,
      gridLevels: 5,
      totalInvestment: 500,
      currentProfit: 37.5,
      profitPercent: 7.5,
      createdTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 7,
      updatedTime: new Date().getTime() - 1000 * 60 * 60 * 12,
      orders: [
        { price: 90, status: 'FILLED', amount: 1.11, side: 'SELL', profit: 8.3 },
        { price: 85, status: 'FILLED', amount: 1.17, side: 'SELL', profit: 9.5 },
        { price: 80, status: 'FILLED', amount: 1.25, side: 'SELL', profit: 6.4 },
        { price: 75, status: 'FILLED', amount: 1.33, side: 'SELL', profit: 7.8 },
        { price: 70, status: 'FILLED', amount: 1.42, side: 'SELL', profit: 5.5 }
      ]
    }
  ];
  
  // Имитируем загрузку данных при монтировании
  useEffect(() => {
    const loadDemoData = setTimeout(() => {
      // В реальном приложении здесь бы использовали fetchActiveGrids и fetchGridHistory
      console.log('Загрузка Smart Grid данных...');
    }, 1000);
    
    return () => clearTimeout(loadDemoData);
  }, []);
  
  // Обработчик закрытия сетки
  const handleCloseGrid = (id) => {
    if (window.confirm('Вы уверены, что хотите закрыть эту сетку?')) {
      closeGrid(id);
    }
  };
  
  // Обработчик создания новой сетки
  const handleCreateGrid = (gridData) => {
    createGrid(gridData);
    setShowCreateModal(false);
  };
  
  // Переключение раскрытия деталей сетки
  const toggleExpandGrid = (id) => {
    if (expandedGridId === id) {
      setExpandedGridId(null);
    } else {
      setExpandedGridId(id);
    }
  };
  
  // Форматирование времени для отображения
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Проверка статуса сетки
  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <StatusBadge status="success" text="АКТИВНА" />;
      case 'COMPLETED':
        return <StatusBadge status="info" text="ЗАВЕРШЕНА" />;
      case 'CANCELLED':
        return <StatusBadge status="warning" text="ОТМЕНЕНА" />;
      case 'ERROR':
        return <StatusBadge status="error" text="ОШИБКА" />;
      default:
        return <StatusBadge status="info" text={status} />;
    }
  };
  
  // Получение цвета класса для направления
  const getDirectionClass = (direction) => {
    switch (direction) {
      case 'BUY':
      case 'LONG':
        return 'text-green-400';
      case 'SELL':
      case 'SHORT':
        return 'text-red-400';
      case 'NEUTRAL':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };
  
  // Рендер карточек Smart Grid
  const renderGridCards = () => {
    // Выбираем данные в зависимости от таба
    const gridsToShow = activeTab === 'active' 
      ? demoGrids.filter(grid => grid.status === 'ACTIVE')
      : demoGrids.filter(grid => grid.status !== 'ACTIVE');
    
    if (isLoading) {
      return <Loader text="Загрузка Smart Grid данных..." />;
    }
    
    if (!gridsToShow || gridsToShow.length === 0) {
      return (
        <EmptyState 
          title={`Нет ${activeTab === 'active' ? 'активных' : 'завершенных'} сеток`}
          description={`${activeTab === 'active' 
            ? 'У вас пока нет активных сеток ордеров. Создайте новую сетку для начала торговли.' 
            : 'История сеток пуста. Завершенные сетки будут отображаться здесь.'}`}
          actionText={activeTab === 'active' ? "Создать сетку" : null}
          onAction={activeTab === 'active' ? () => setShowCreateModal(true) : null}
          icon={<Grid size={40} className="text-gray-600" />}
        />
      );
    }
    
    return (
      <div className="space-y-4">
        {gridsToShow.map(grid => (
          <Card key={grid.id} padding="normal" className="hover:bg-gray-750/50">
            <div>
              {/* Заголовок сетки */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="font-semibold flex items-center">
                    {grid.pair} 
                    <span className={`text-sm ml-2 ${getDirectionClass(grid.direction)}`}>
                      ({grid.direction})
                    </span>
                  </h4>
                  <div className="text-sm text-gray-400 mt-1">
                    Создана: {formatDate(grid.createdTime)}
                  </div>
                </div>
                <div className="flex items-center">
                  {getStatusBadge(grid.status)}
                  <button 
                    className="ml-2 p-1 text-gray-400 hover:text-white"
                    onClick={() => toggleExpandGrid(grid.id)}
                  >
                    {expandedGridId === grid.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                </div>
              </div>
              
              {/* Основная информация */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-400">Начальная цена</div>
                  <div className="font-medium">${grid.startPrice}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Верхний/Нижний лимит</div>
                  <div className="font-medium">${grid.upperLimit} / ${grid.lowerLimit}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Количество уровней</div>
                  <div className="font-medium">{grid.gridLevels}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Инвестировано</div>
                  <div className="font-medium">${grid.totalInvestment}</div>
                </div>
              </div>
              
              {/* Статистика прибыли */}
              <div className="flex justify-between items-center p-3 bg-gray-750 rounded-lg">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                    <DollarSign size={20} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Прибыль</div>
                    <div className="font-medium text-green-400">+${grid.currentProfit} (+{grid.profitPercent}%)</div>
                  </div>
                </div>
                
                {grid.status === 'ACTIVE' && (
                  <button 
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm"
                    onClick={() => handleCloseGrid(grid.id)}
                  >
                    Закрыть сетку
                  </button>
                )}
              </div>
              
              {/* Развернутые детали сетки */}
              {expandedGridId === grid.id && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <h5 className="font-medium mb-3">Ордера сетки</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-gray-750">
                        <tr>
                          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Цена</th>
                          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Количество</th>
                          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Сторона</th>
                          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Статус</th>
                          <th className="py-2 px-3 text-left text-xs font-medium text-gray-400">Прибыль</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {grid.orders.map((order, index) => (
                          <tr key={`${grid.id}_order_${index}`} className="hover:bg-gray-800/30">
                            <td className="py-2 px-3 text-sm">${order.price}</td>
                            <td className="py-2 px-3 text-sm">{order.amount}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                order.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {order.side}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {order.status === 'FILLED' ? (
                                <span className="text-xs flex items-center text-green-400">
                                  <CheckCircle size={12} className="mr-1" /> Исполнен
                                </span>
                              ) : (
                                <span className="text-xs flex items-center text-blue-400">
                                  <Clock size={12} className="mr-1" /> Открыт
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm">
                              {order.status === 'FILLED' ? (
                                <span className="text-green-400">+${order.profit}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
                    <div className="text-sm text-gray-400">
                      Последнее обновление: {formatDate(grid.updatedTime)}
                    </div>
                    <div className="flex space-x-2">
                      <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center">
                        <RefreshCw size={14} className="mr-1" /> Обновить
                      </button>
                      <button className="text-gray-400 hover:text-white text-sm">
                        Подробнее
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };
  
  // Компонент модального окна создания сетки
  const CreateGridModal = () => {
    const [formData, setFormData] = useState({
      pair: 'BTC/USDT',
      direction: 'NEUTRAL',
      upperLimit: '',
      lowerLimit: '',
      gridLevels: 10,
      totalInvestment: 1000
    });
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      handleCreateGrid(formData);
    };
    
    // Расчет примерного дохода (упрощенная формула)
    const calculateEstimatedProfit = () => {
      const { upperLimit, lowerLimit, gridLevels, totalInvestment } = formData;
      
      if (!upperLimit || !lowerLimit || upperLimit <= lowerLimit) return { profit: 0, percent: 0 };
      
      // Примерный расчет в упрощенной форме
      const priceRange = upperLimit - lowerLimit;
      const volatilityFactor = 0.8; // Предполагаемый фактор волатильности
      const tradingFeePercent = 0.1; // Комиссия в процентах
      
      // Расчет прибыли на основе диапазона цен, количества сеток и инвестиций
      const estimatedProfitPercent = (priceRange / ((upperLimit + lowerLimit) / 2)) * 100 * volatilityFactor * (gridLevels / 10) - tradingFeePercent;
      const estimatedProfit = totalInvestment * (estimatedProfitPercent / 100);
      
      return {
        profit: Math.round(estimatedProfit * 100) / 100,
        percent: Math.round(estimatedProfitPercent * 100) / 100
      };
    };
    
    const estimatedProfit = calculateEstimatedProfit();
    
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl">
          <div className="flex justify-between items-center border-b border-gray-700 p-4">
            <h2 className="text-xl font-bold">Создание новой Smart Grid</h2>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={() => setShowCreateModal(false)}
            >
              &times;
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Торговая пара</label>
                <select
                  name="pair"
                  value={formData.pair}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                >
                  <option value="BTC/USDT">BTC/USDT</option>
                  <option value="ETH/USDT">ETH/USDT</option>
                  <option value="SOL/USDT">SOL/USDT</option>
                  <option value="XRP/USDT">XRP/USDT</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Направление сетки</label>
                <select
                  name="direction"
                  value={formData.direction}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                >
                  <option value="NEUTRAL">Нейтральная (Long & Short)</option>
                  <option value="LONG">Только Long</option>
                  <option value="SHORT">Только Short</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Верхний лимит цены ($)</label>
                <input 
                  type="number"
                  name="upperLimit"
                  value={formData.upperLimit}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="Например: 45000"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Нижний лимит цены ($)</label>
                <input 
                  type="number"
                  name="lowerLimit"
                  value={formData.lowerLimit}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="Например: 40000"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Количество уровней сетки</label>
                <div className="flex items-center">
                  <input 
                    type="range" 
                    name="gridLevels"
                    min="5" 
                    max="50" 
                    value={formData.gridLevels}
                    onChange={handleChange}
                    className="w-full mr-2"
                  />
                  <span className="w-8 text-center">{formData.gridLevels}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Сумма инвестиций ($)</label>
                <input 
                  type="number"
                  name="totalInvestment"
                  value={formData.totalInvestment}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="Например: 1000"
                  required
                />
              </div>
            </div>
            
            <div className="border border-gray-700 rounded-lg p-4 mb-6">
              <h3 className="font-medium mb-3">Прогнозируемая прибыль</h3>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                    <DollarSign size={20} className="text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Примерная прибыль за месяц</div>
                    <div className="font-medium text-green-400">
                      +${estimatedProfit.profit} (+{estimatedProfit.percent}%)
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  *При условии волатильности рынка
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button 
                type="button"
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              
              <div className="flex space-x-2">
                <button 
                  type="button"
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  AI оптимизация
                </button>
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Создать сетку
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-6 w-full h-full overflow-y-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Adaptive Smart Grid</h1>
          <p className="text-gray-400">Автоматическая торговля с помощью адаптивных сеток ордеров</p>
        </div>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
          onClick={() => setShowCreateModal(true)}
        >
          <PlusCircle size={18} className="mr-2" />
          Создать сетку
        </button>
      </div>
      
      {/* Карточки с общей статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <Grid size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Активные сетки</p>
              <p className="text-lg font-semibold text-white">2</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
              <DollarSign size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Общая прибыль (30 дн)</p>
              <p className="text-lg font-semibold text-green-400">+$128.46</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
              <TrendingUp size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Средняя доходность</p>
              <p className="text-lg font-semibold text-white">4.7% / месяц</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
              <Zap size={20} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Активные сделки</p>
              <p className="text-lg font-semibold text-white">7</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Табы и основной контент */}
      <Card>
        <div className="border-b border-gray-700 mb-4">
          <div className="flex">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'active' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('active')}
            >
              Активные сетки
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'history' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('history')}
            >
              История сеток
            </button>
          </div>
        </div>
        
        {renderGridCards()}
      </Card>
      
      {/* Модальное окно создания сетки */}
      {showCreateModal && <CreateGridModal />}
    </div>
  );
};

export default SmartGridContent;