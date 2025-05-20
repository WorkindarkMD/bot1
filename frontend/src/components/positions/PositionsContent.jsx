import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  DollarSign, BarChart2, TrendingUp, TrendingDown, Clock, 
  CheckCircle, XCircle, AlertCircle, ArrowRight, Filter, 
  Search, RefreshCw, Download, ChevronDown, Eye
} from 'lucide-react';
import Card from '../common/Card';
import Loader from '../common/Loader';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import useApi from '../../hooks/useApi';

const PositionsContent = () => {
  const positions = useSelector(state => state.positions);
const positionHistory = useSelector(state => state.positionHistory);
const isLoading = useSelector(state => state.isLoading);
  const { fetchPositions, fetchPositionHistory, closePosition } = useApi();
  
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  
  // Для демонстрации создаем примерные позиции
  const demoPositions = [
    {
      id: 'pos_1',
      pair: 'BTC/USDT',
      direction: 'LONG',
      entryPrice: 42500,
      currentPrice: 43100,
      stopLoss: 41800,
      takeProfit: 44500,
      size: 0.05,
      leverage: 10,
      margin: 212.5,
      status: 'OPEN',
      profit: 140,
      profitPercent: 6.59,
      openTime: new Date().getTime() - 1000 * 60 * 60 * 5,
      exchange: 'binance',
      source: 'ai-analyzer',
      closeReason: null,
      orderId: '123456789'
    },
    {
      id: 'pos_2',
      pair: 'ETH/USDT',
      direction: 'SHORT',
      entryPrice: 2900,
      currentPrice: 2850,
      stopLoss: 2950,
      takeProfit: 2750,
      size: 0.75,
      leverage: 5,
      margin: 435,
      status: 'OPEN',
      profit: 37.5,
      profitPercent: 8.62,
      openTime: new Date().getTime() - 1000 * 60 * 60 * 12,
      exchange: 'bybit',
      source: 'manual',
      closeReason: null,
      orderId: '987654321'
    }
  ];
  
  // История позиций
  const demoHistory = [
    {
      id: 'pos_3',
      pair: 'SOL/USDT',
      direction: 'LONG',
      entryPrice: 76.5,
      closePrice: 82.4,
      stopLoss: 72.0,
      takeProfit: 85.0,
      size: 2.5,
      leverage: 3,
      margin: 63.75,
      status: 'CLOSED',
      profit: 14.75,
      profitPercent: 23.13,
      openTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 2,
      closeTime: new Date().getTime() - 1000 * 60 * 60 * 6,
      exchange: 'binance',
      source: 'copy-trading',
      closeReason: 'take-profit',
      orderId: '567891234'
    },
    {
      id: 'pos_4',
      pair: 'XRP/USDT',
      direction: 'SHORT',
      entryPrice: 0.58,
      closePrice: 0.61,
      stopLoss: 0.62,
      takeProfit: 0.52,
      size: 500,
      leverage: 2,
      margin: 145,
      status: 'CLOSED',
      profit: -15,
      profitPercent: -10.34,
      openTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 3,
      closeTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 1,
      exchange: 'mexc',
      source: 'manual',
      closeReason: 'stop-loss',
      orderId: '987123456'
    }
  ];
  
  // Имитируем загрузку данных при монтировании
  useEffect(() => {
    const loadDemoData = setTimeout(() => {
      // В реальном приложении здесь был бы вызов fetchPositions() и fetchPositionHistory()
      console.log('Загрузка позиций...');
    }, 1000);
    
    return () => clearTimeout(loadDemoData);
  }, []);
  
  // Обработчики
  const handleClosePosition = (position) => {
    if (window.confirm(`Вы уверены, что хотите закрыть позицию ${position.direction} ${position.pair}?`)) {
      closePosition(position.id);
    }
  };
  
  const handleShowPositionDetails = (position) => {
    setSelectedPosition(position);
    setShowPositionModal(true);
  };
  
  // Фильтрация по поисковому запросу
  const getFilteredPositions = (positions) => {
    if (!positions) return [];
    
    return positions.filter(position => 
      position.pair.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.exchange.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  
  // Форматирование времени
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const formatTimeSince = (timestamp) => {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    
    const intervals = {
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };
    
    if (seconds < 5) {
      return 'только что';
    }
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        const suffix = interval === 1 
          ? (unit === 'day' ? 'день' : unit === 'hour' ? 'час' : unit === 'minute' ? 'минуту' : 'секунду') 
          : (unit === 'day' ? 'дней' : unit === 'hour' ? 'часов' : unit === 'minute' ? 'минут' : 'секунд');
        return `${interval} ${suffix} назад`;
      }
    }
  };
  
  // Выбор данных в зависимости от активного таба
  const positionsToShow = activeTab === 'active' ? demoPositions : demoHistory;
  const filteredPositions = getFilteredPositions(positionsToShow);
  
  // Рендер таблицы позиций
  const renderPositionsTable = () => {
    if (isLoading) {
      return <Loader text="Загрузка позиций..." />;
    }
    
    if (!filteredPositions || filteredPositions.length === 0) {
      return (
        <EmptyState 
          title={`${activeTab === 'active' ? 'Активные позиции' : 'История позиций'} не найдены`}
          description={`У вас нет ${activeTab === 'active' ? 'открытых позиций' : 'завершенных позиций'} по выбранным фильтрам.`}
          icon={<DollarSign size={40} className="text-gray-600" />}
        />
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-750">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">ID</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Пара</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Направление</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Вход</th>
              {activeTab === 'active' ? (
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Текущая цена</th>
              ) : (
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Выход</th>
              )}
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Размер</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Прибыль</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Биржа</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredPositions.map(position => (
              <tr key={position.id} className="hover:bg-gray-750">
                <td className="py-3 px-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-300">{position.id.slice(0, 8)}</span>
                    <span className="text-xs text-gray-500">
                      {activeTab === 'active' ? (
                        formatTimeSince(position.openTime)
                      ) : (
                        formatTimeSince(position.closeTime)
                      )}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 font-medium">{position.pair}</td>
                <td className="py-3 px-4">
                  <span className={`${
                    position.direction === 'LONG' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  } px-2 py-1 rounded text-xs`}>
                    {position.direction}
                  </span>
                </td>
                <td className="py-3 px-4">${position.entryPrice}</td>
                {activeTab === 'active' ? (
                  <td className="py-3 px-4">${position.currentPrice}</td>
                ) : (
                  <td className="py-3 px-4">${position.closePrice}</td>
                )}
                <td className="py-3 px-4">
                  <div className="text-sm">
                    <div>{position.size} {position.pair.split('/')[0]}</div>
                    <div className="text-xs text-gray-400">{position.leverage}x</div>
                  </div>
                </td>
                <td className={`py-3 px-4 ${position.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  <div className="font-medium">${position.profit.toFixed(2)}</div>
                  <div className="text-xs">{position.profit >= 0 ? '+' : ''}{position.profitPercent.toFixed(2)}%</div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-gray-600 rounded-full mr-2 flex-shrink-0"></div>
                    <span className="capitalize">{position.exchange}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {activeTab === 'active' ? (
                    <div className="flex space-x-2">
                      <button 
                        className="bg-gray-700 hover:bg-gray-600 text-gray-200 p-1 rounded"
                        onClick={() => handleShowPositionDetails(position)}
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-1 rounded"
                        onClick={() => handleClosePosition(position)}
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="bg-gray-700 hover:bg-gray-600 text-gray-200 p-1 rounded"
                      onClick={() => handleShowPositionDetails(position)}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Модальное окно с деталями позиции
  const PositionDetailsModal = ({ position, onClose }) => {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-gray-700 p-4">
            <h2 className="text-xl font-bold">Детали позиции {position.pair}</h2>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:space-x-8 mb-6">
              <div className="w-full">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className={`${
                      position.direction === 'LONG' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    } px-3 py-1 rounded text-sm font-medium`}>
                      {position.direction}
                    </span>
                  </div>
                  <div>
                    {position.status === 'OPEN' ? (
                      <StatusBadge status="success" text="ОТКРЫТА" />
                    ) : (
                      <StatusBadge status="info" text="ЗАКРЫТА" />
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Вход</div>
                    <div className="text-lg font-medium">${position.entryPrice}</div>
                  </div>
                  
                  {position.status === 'OPEN' ? (
                    <div className="bg-gray-750 p-3 rounded-lg">
                      <div className="text-xs text-gray-400">Текущая цена</div>
                      <div className="text-lg font-medium">${position.currentPrice}</div>
                    </div>
                  ) : (
                    <div className="bg-gray-750 p-3 rounded-lg">
                      <div className="text-xs text-gray-400">Выход</div>
                      <div className="text-lg font-medium">${position.closePrice}</div>
                    </div>
                  )}
                  
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Размер</div>
                    <div className="text-lg font-medium">{position.size} {position.pair.split('/')[0]}</div>
                  </div>
                  
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Кредитное плечо</div>
                    <div className="text-lg font-medium">{position.leverage}x</div>
                  </div>
                  
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Маржа</div>
                    <div className="text-lg font-medium">${position.margin}</div>
                  </div>
                  
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Источник</div>
                    <div className="text-lg font-medium capitalize">{position.source}</div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-gray-750 p-4 rounded-lg mb-6">
                  <div>
                    <div className="text-sm text-gray-400">Прибыль/Убыток</div>
                    <div className={`text-xl font-medium ${position.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${position.profit.toFixed(2)} ({position.profit >= 0 ? '+' : ''}{position.profitPercent.toFixed(2)}%)
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="text-sm text-gray-400">Биржа</div>
                    <div className="text-lg font-medium capitalize">{position.exchange}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Stop Loss</div>
                    <div className="text-lg font-medium text-red-400">${position.stopLoss}</div>
                  </div>
                  
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Take Profit</div>
                    <div className="text-lg font-medium text-green-400">${position.takeProfit}</div>
                  </div>
                </div>
                
                <div className="bg-gray-750 p-4 rounded-lg mb-6">
                  <h3 className="font-medium mb-2">Временная информация</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Открыта:</span>
                      <span>{formatDate(position.openTime)}</span>
                    </div>
                    
                    {position.status === 'CLOSED' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Закрыта:</span>
                          <span>{formatDate(position.closeTime)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Причина закрытия:</span>
                          <span className="capitalize">{position.closeReason}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">ID ордера:</span>
                      <span>{position.orderId}</span>
                    </div>
                  </div>
                </div>
                
                {position.status === 'OPEN' && (
                  <div className="flex justify-end space-x-3">
                    <button 
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                      onClick={onClose}
                    >
                      Закрыть окно
                    </button>
                    <button 
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center"
                      onClick={() => {
                        handleClosePosition(position);
                        onClose();
                      }}
                    >
                      <XCircle size={16} className="mr-2" />
                      Закрыть позицию
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-6 w-full h-full overflow-y-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Позиции</h1>
          <p className="text-gray-400">Управление активными позициями и просмотр истории сделок</p>
        </div>
      </div>
      
      {/* Карточки с статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <DollarSign size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Активные позиции</p>
              <p className="text-lg font-semibold text-white">{demoPositions.length}</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
              <TrendingUp size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Общая прибыль</p>
              <p className="text-lg font-semibold text-green-400">
                $
                {demoPositions.reduce((sum, pos) => sum + pos.profit, 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
              <BarChart2 size={20} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Win Rate</p>
              <p className="text-lg font-semibold text-white">68%</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
              <Clock size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Средн. время сделки</p>
              <p className="text-lg font-semibold text-white">16ч 24м</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Основной контент */}
      <Card>
        <div className="border-b border-gray-700 mb-4">
          <div className="flex">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'active' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('active')}
            >
              Активные позиции
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'history' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('history')}
            >
              История позиций
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row mb-4 gap-4 p-4">
          <div className="relative flex-grow">
            <input 
              type="text" 
              placeholder="Поиск позиций..." 
              className="w-full bg-gray-700 text-white pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          </div>
          <div className="flex items-center space-x-2">
            <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center">
              <Filter size={16} className="mr-1" />
              Фильтры
            </button>
            <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center">
              <RefreshCw size={16} className="mr-1" />
              Обновить
            </button>
            {activeTab === 'history' && (
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center">
                <Download size={16} className="mr-1" />
                Экспорт
              </button>
            )}
          </div>
        </div>
        
        {renderPositionsTable()}
      </Card>
      
      {/* Модальное окно с деталями позиции */}
      {showPositionModal && selectedPosition && (
        <PositionDetailsModal 
          position={selectedPosition}
          onClose={() => {
            setShowPositionModal(false);
            setSelectedPosition(null);
          }}
        />
      )}
    </div>
  );
};

export default PositionsContent;