import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  Activity, Users, Star, Shield, TrendingUp, TrendingDown, 
  DollarSign, Zap, RefreshCw, Search, PlusCircle, Copy, 
  CheckCircle, AlertCircle, Settings, Filter
} from 'lucide-react';
import Card from '../common/Card';
import Loader from '../common/Loader';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import useApi from '../../hooks/useApi';

const CopyTradingContent = () => {
  const traders = useSelector(state => state.traders);
const isLoading = useSelector(state => state.isLoading);
  const { fetchTraders, startCopyTrading, stopCopyTrading, enhanceSignal } = useApi();
  
  const [activeTab, setActiveTab] = useState('traders');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [showTraderDetails, setShowTraderDetails] = useState(false);
  
  // Для демонстрации создадим примерных трейдеров
  const demoTraders = [
    {
      id: 'trader_1',
      name: 'CryptoWhale',
      exchange: 'binance',
      winRate: 76,
      profitFactor: 2.8,
      totalTrades: 325,
      roi: 128.5,
      followers: 1250,
      verified: true,
      description: 'Профессиональный трейдер с более чем 5-летним опытом. Специализируется на фьючерсной торговле BTC и ETH.',
      aiScore: 92,
      tradingStyle: 'Swing Trading',
      positions: [
        { pair: 'BTC/USDT', direction: 'LONG', entryPrice: 42310, currentPrice: 42950, profit: 1.5, time: new Date().getTime() - 1000 * 60 * 60 * 5 },
        { pair: 'ETH/USDT', direction: 'LONG', entryPrice: 2850, currentPrice: 2920, profit: 2.4, time: new Date().getTime() - 1000 * 60 * 60 * 2 }
      ]
    },
    {
      id: 'trader_2',
      name: 'AlphaHunter',
      exchange: 'bybit',
      winRate: 68,
      profitFactor: 2.3,
      totalTrades: 287,
      roi: 94.2,
      followers: 850,
      verified: true,
      description: 'Трейдер со стратегией, основанной на техническом анализе и торговле тенденций. Фокусируется на альткоинах с высокой волатильностью.',
      aiScore: 84,
      tradingStyle: 'Trend Following',
      positions: [
        { pair: 'SOL/USDT', direction: 'LONG', entryPrice: 78.2, currentPrice: 82.4, profit: 5.3, time: new Date().getTime() - 1000 * 60 * 60 * 8 },
        { pair: 'AVAX/USDT', direction: 'SHORT', entryPrice: 35.4, currentPrice: 32.6, profit: 7.9, time: new Date().getTime() - 1000 * 60 * 60 * 3 }
      ]
    },
    {
      id: 'trader_3',
      name: 'CryptoNinja',
      exchange: 'binance',
      winRate: 72,
      profitFactor: 2.1,
      totalTrades: 412,
      roi: 86.8,
      followers: 1080,
      verified: false,
      description: 'Специализируется на краткосрочной торговле с использованием индикаторов SMC и паттернов.',
      aiScore: 78,
      tradingStyle: 'Day Trading',
      positions: [
        { pair: 'XRP/USDT', direction: 'LONG', entryPrice: 0.58, currentPrice: 0.61, profit: 5.2, time: new Date().getTime() - 1000 * 60 * 60 * 6 }
      ]
    }
  ];
  
  // Список моих копируемых трейдеров
  const demoMonitors = [
    {
      id: 'monitor_1',
      traderId: 'trader_1',
      traderName: 'CryptoWhale',
      exchange: 'binance',
      status: 'ACTIVE',
      startTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 3,
      aiEnhancement: true,
      totalCopiedTrades: 12,
      profit: 32.5,
      settings: {
        allocation: 10, // % от баланса
        maxPositions: 3,
        stopLoss: true,
        takeProfit: true
      }
    },
    {
      id: 'monitor_2',
      traderId: 'trader_3',
      traderName: 'CryptoNinja',
      exchange: 'binance',
      status: 'PAUSED',
      startTime: new Date().getTime() - 1000 * 60 * 60 * 24 * 7,
      aiEnhancement: false,
      totalCopiedTrades: 8,
      profit: -5.2,
      settings: {
        allocation: 5, // % от баланса
        maxPositions: 2,
        stopLoss: true,
        takeProfit: false
      }
    }
  ];
  
  // Имитируем загрузку данных при монтировании
  useEffect(() => {
    const loadDemoData = setTimeout(() => {
      // В реальном приложении здесь был бы вызов fetchTraders()
      console.log('Загрузка данных трейдеров...');
    }, 1000);
    
    return () => clearTimeout(loadDemoData);
  }, []);
  
  // Обработчики
  const handleCopyTrader = (trader) => {
    setSelectedTrader(trader);
    setShowTraderDetails(true);
  };
  
  const handleStartCopying = (trader, settings) => {
    startCopyTrading({
      traderId: trader.id,
      exchange: trader.exchange,
      settings: settings,
      aiEnhancement: true
    });
    setShowTraderDetails(false);
  };
  
  const handleStopCopying = (monitorId) => {
    if (window.confirm('Вы уверены, что хотите остановить копирование этого трейдера?')) {
      stopCopyTrading(monitorId);
    }
  };
  
  // Фильтрация трейдеров
  const getFilteredTraders = () => {
    return demoTraders.filter(trader => 
      trader.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trader.exchange.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };
  
  // Расчет рейтинга для сортировки
  const calculateRating = (trader) => {
    return (trader.winRate * 0.3) + (trader.profitFactor * 10) + (trader.aiScore * 0.5);
  };
  
  // Форматирование даты
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };
  
  // Фильтрованные данные
  const filteredTraders = getFilteredTraders();
  
  // Рендер карточек трейдеров
  const renderTraderCards = () => {
    if (isLoading) {
      return <Loader text="Загрузка трейдеров..." />;
    }
    
    if (!filteredTraders || filteredTraders.length === 0) {
      return (
        <EmptyState 
          title="Трейдеры не найдены"
          description="По вашему запросу не найдено трейдеров. Попробуйте изменить параметры поиска."
          icon={<Users size={40} className="text-gray-600" />}
        />
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTraders.map(trader => (
          <Card key={trader.id} padding="normal" className="hover:border hover:border-blue-500 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                  <Activity size={18} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium flex items-center">
                    {trader.name}
                    {trader.verified && <Shield size={14} className="text-green-400 ml-1" />}
                  </h4>
                  <div className="text-xs text-gray-400 mt-1">
                    {trader.exchange.toUpperCase()} • {trader.tradingStyle}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <Star size={14} className="text-yellow-400 mr-1" />
                <span className="text-sm">{trader.aiScore}%</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-700/30 p-2 rounded">
                <div className="text-xs text-gray-400">Win Rate</div>
                <div className="font-medium">{trader.winRate}%</div>
              </div>
              <div className="bg-gray-700/30 p-2 rounded">
                <div className="text-xs text-gray-400">PF</div>
                <div className="font-medium">{trader.profitFactor}</div>
              </div>
              <div className="bg-gray-700/30 p-2 rounded">
                <div className="text-xs text-gray-400">ROI</div>
                <div className="font-medium text-green-400">+{trader.roi}%</div>
              </div>
              <div className="bg-gray-700/30 p-2 rounded">
                <div className="text-xs text-gray-400">Сделки</div>
                <div className="font-medium">{trader.totalTrades}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="text-gray-400">Подписчики</div>
              <div>{trader.followers}</div>
            </div>
            
            <div className="flex justify-between">
              <button 
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
                onClick={() => setSelectedTrader(trader)}
              >
                Подробнее
              </button>
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center"
                onClick={() => handleCopyTrader(trader)}
              >
                <Copy size={14} className="mr-1" />
                Копировать
              </button>
            </div>
          </Card>
        ))}
      </div>
    );
  };
  
  // Рендер активных мониторов копирования
  const renderMonitors = () => {
    if (isLoading) {
      return <Loader text="Загрузка мониторов..." />;
    }
    
    if (!demoMonitors || demoMonitors.length === 0) {
      return (
        <EmptyState 
          title="Нет активных копирований"
          description="Вы пока не копируете ни одного трейдера. Найдите трейдера на вкладке 'Трейдеры' и начните копировать."
          actionText="Найти трейдеров"
          onAction={() => setActiveTab('traders')}
          icon={<Copy size={40} className="text-gray-600" />}
        />
      );
    }
    
    return (
      <div className="space-y-4">
        {demoMonitors.map(monitor => (
          <Card key={monitor.id} padding="normal">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                  <Activity size={18} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium">{monitor.traderName}</h4>
                  <div className="text-xs text-gray-400 mt-1">
                    {monitor.exchange.toUpperCase()} • С {formatDate(monitor.startTime)}
                  </div>
                </div>
              </div>
              <div>
                {monitor.status === 'ACTIVE' ? (
                  <StatusBadge status="success" text="АКТИВЕН" />
                ) : (
                  <StatusBadge status="warning" text="ПРИОСТАНОВЛЕН" />
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-gray-700/20 rounded-lg mb-4">
              <div className="flex items-center">
                <DollarSign size={18} className={`${monitor.profit >= 0 ? 'text-green-400' : 'text-red-400'} mr-2`} />
                <div>
                  <div className="text-xs text-gray-400">Общая прибыль</div>
                  <div className={`font-medium ${monitor.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {monitor.profit >= 0 ? '+' : ''}{monitor.profit}%
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Скопировано сделок</div>
                <div className="font-medium text-center">{monitor.totalCopiedTrades}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">AI-улучшение</div>
                <div className="font-medium text-center">
                  {monitor.aiEnhancement ? (
                    <span className="text-green-400 flex items-center justify-center">
                      <CheckCircle size={14} className="mr-1" /> Вкл
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center justify-center">
                      <AlertCircle size={14} className="mr-1" /> Выкл
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Настройки копирования:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-700/30 p-2 rounded">
                  <div className="text-xs text-gray-400">Размер</div>
                  <div className="font-medium">{monitor.settings.allocation}%</div>
                </div>
                <div className="bg-gray-700/30 p-2 rounded">
                  <div className="text-xs text-gray-400">Макс. позиций</div>
                  <div className="font-medium">{monitor.settings.maxPositions}</div>
                </div>
                <div className="bg-gray-700/30 p-2 rounded">
                  <div className="text-xs text-gray-400">StopLoss</div>
                  <div className="font-medium">{monitor.settings.stopLoss ? 'Да' : 'Нет'}</div>
                </div>
                <div className="bg-gray-700/30 p-2 rounded">
                  <div className="text-xs text-gray-400">TakeProfit</div>
                  <div className="font-medium">{monitor.settings.takeProfit ? 'Да' : 'Нет'}</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <button 
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm flex items-center"
                onClick={() => setSelectedTrader(demoTraders.find(t => t.id === monitor.traderId))}
              >
                <Settings size={14} className="mr-1" />
                Настройки
              </button>
              <button 
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm flex items-center"
                onClick={() => handleStopCopying(monitor.id)}
              >
                <AlertCircle size={14} className="mr-1" />
                {monitor.status === 'ACTIVE' ? 'Остановить' : 'Удалить'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    );
  };
  
  // Модальное окно деталей трейдера
  const TraderDetailsModal = ({ trader, onClose, onCopy }) => {
    const [allocation, setAllocation] = useState(5);
    const [maxPositions, setMaxPositions] = useState(2);
    const [enableStopLoss, setEnableStopLoss] = useState(true);
    const [enableTakeProfit, setEnableTakeProfit] = useState(true);
    const [aiEnhancement, setAiEnhancement] = useState(true);
    
    const handleStartCopying = () => {
      onCopy(trader, {
        allocation,
        maxPositions,
        stopLoss: enableStopLoss,
        takeProfit: enableTakeProfit,
        aiEnhancement
      });
    };
    
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-gray-700 p-4">
            <h2 className="text-xl font-bold flex items-center">
              {trader.name}
              {trader.verified && <Shield size={16} className="text-green-400 ml-2" />}
            </h2>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:space-x-8 mb-6">
              <div className="w-full md:w-2/3">
                <div className="bg-gray-750 p-4 rounded-lg mb-4">
                  <h3 className="font-medium mb-2">О трейдере</h3>
                  <p className="text-gray-300 text-sm">{trader.description}</p>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Win Rate</div>
                    <div className="text-xl font-medium">{trader.winRate}%</div>
                  </div>
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Profit Factor</div>
                    <div className="text-xl font-medium">{trader.profitFactor}</div>
                  </div>
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">ROI</div>
                    <div className="text-xl font-medium text-green-400">+{trader.roi}%</div>
                  </div>
                  <div className="bg-gray-750 p-3 rounded-lg">
                    <div className="text-xs text-gray-400">Сделки</div>
                    <div className="text-xl font-medium">{trader.totalTrades}</div>
                  </div>
                </div>
                
                <div className="bg-gray-750 p-4 rounded-lg">
                  <h3 className="font-medium mb-3 flex items-center">
                    <Zap size={16} className="text-yellow-400 mr-2" />
                    AI Анализ трейдера
                  </h3>
                  <div className="flex space-x-2 items-center mb-3">
                    <div className="h-2 flex-grow bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" style={{width: `${trader.aiScore}%`}}></div>
                    </div>
                    <span className="text-sm font-medium">{trader.aiScore}%</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Трейдер демонстрирует стабильные результаты с хорошим соотношением риска и доходности. 
                    Торговый стиль: <span className="font-medium">{trader.tradingStyle}</span>. 
                    Рекомендуется для копирования с ограниченным риском.
                  </p>
                </div>
              </div>
              
              <div className="w-full md:w-1/3 mt-4 md:mt-0">
                <div className="bg-gray-750 p-4 rounded-lg mb-4">
                  <h3 className="font-medium mb-2">Активные позиции</h3>
                  {trader.positions.length > 0 ? (
                    <div className="space-y-3">
                      {trader.positions.map((position, index) => (
                        <div key={index} className="bg-gray-700/30 p-2 rounded">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{position.pair}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              position.direction === 'LONG' 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {position.direction}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Вход: ${position.entryPrice}</span>
                            <span className={position.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {position.profit >= 0 ? '+' : ''}{position.profit}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Нет активных позиций</p>
                  )}
                </div>
                
                <div className="bg-gray-750 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Настройки копирования</h3>
                  
                  <div className="mb-3">
                    <label className="text-sm text-gray-400 mb-1 block">Размер позиции (% от баланса)</label>
                    <div className="flex items-center">
                      <input 
                        type="range" 
                        min="1" 
                        max="25" 
                        value={allocation}
                        onChange={(e) => setAllocation(e.target.value)}
                        className="w-full mr-2" 
                      />
                      <span className="w-6 text-center">{allocation}%</span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="text-sm text-gray-400 mb-1 block">Максимум одновременных позиций</label>
                    <div className="flex items-center">
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={maxPositions}
                        onChange={(e) => setMaxPositions(e.target.value)}
                        className="w-full mr-2" 
                      />
                      <span className="w-6 text-center">{maxPositions}</span>
                    </div>
                  </div>
                  
                  <div className="mb-3 flex justify-between items-center">
                    <label className="text-sm">Использовать Stop Loss</label>
                    <div 
                      className={`relative inline-block w-12 h-6 rounded-full ${enableStopLoss ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
                      onClick={() => setEnableStopLoss(!enableStopLoss)}
                    >
                      <div className={`absolute ${enableStopLoss ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
                    </div>
                  </div>
                  
                  <div className="mb-3 flex justify-between items-center">
                    <label className="text-sm">Использовать Take Profit</label>
                    <div 
                      className={`relative inline-block w-12 h-6 rounded-full ${enableTakeProfit ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
                      onClick={() => setEnableTakeProfit(!enableTakeProfit)}
                    >
                      <div className={`absolute ${enableTakeProfit ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
                    </div>
                  </div>
                  
                  <div className="mb-3 flex justify-between items-center">
                    <label className="text-sm">AI-улучшение сигналов</label>
                    <div 
                      className={`relative inline-block w-12 h-6 rounded-full ${aiEnhancement ? 'bg-green-500' : 'bg-gray-700'} cursor-pointer`}
                      onClick={() => setAiEnhancement(!aiEnhancement)}
                    >
                      <div className={`absolute ${aiEnhancement ? 'right-1' : 'left-1'} top-1 w-4 h-4 rounded-full bg-white`}></div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                    <div className="flex items-start">
                      <AlertCircle size={16} className="text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-xs text-blue-300">
                        AI-улучшение автоматически оптимизирует сигналы трейдера, корректируя точки входа, StopLoss и TakeProfit на основе анализа рынка.
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center"
                    onClick={handleStartCopying}
                  >
                    <Copy size={16} className="mr-2" />
                    Начать копирование
                  </button>
                </div>
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
          <h1 className="text-2xl font-bold mb-2">Копитрейдинг + AI</h1>
          <p className="text-gray-400">Копирование сделок успешных трейдеров с улучшением сигналов с помощью ИИ</p>
        </div>
      </div>
      
      {/* Карточки с статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Доступно трейдеров</p>
              <p className="text-lg font-semibold text-white">156</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
              <Copy size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Активные копирования</p>
              <p className="text-lg font-semibold text-white">{demoMonitors.filter(m => m.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mr-3">
              <DollarSign size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Общая прибыль</p>
              <p className="text-lg font-semibold text-green-400">+$128.46</p>
            </div>
          </div>
        </Card>
        
        <Card padding="small" className="p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
              <Zap size={20} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">AI-улучшенные сигналы</p>
              <p className="text-lg font-semibold text-white">86%</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Табы и основной контент */}
      <Card>
        <div className="border-b border-gray-700 mb-4">
          <div className="flex">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'traders' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('traders')}
            >
              Трейдеры
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'monitors' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('monitors')}
            >
              Мои копирования
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'settings' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'}`}
              onClick={() => setActiveTab('settings')}
            >
              Настройки
            </button>
          </div>
        </div>
        
        {activeTab === 'traders' && (
          <>
            <div className="flex flex-col md:flex-row mb-4 gap-4">
              <div className="relative w-full md:w-1/3">
                <input 
                  type="text" 
                  placeholder="Поиск трейдеров..." 
                  className="w-full bg-gray-700 text-white pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              </div>
              <div className="flex items-center space-x-2">
                <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center">
                  <Filter size={16} className="mr-2" />
                  Фильтры
                </button>
                <select className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500">
                  <option value="rating">По рейтингу</option>
                  <option value="roi">По ROI</option>
                  <option value="winrate">По Win Rate</option>
                </select>
              </div>
            </div>
            
            {renderTraderCards()}
          </>
        )}
        
        {activeTab === 'monitors' && renderMonitors()}
        
        {activeTab === 'settings' && (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Настройки копитрейдинга</h3>
            
            <div className="space-y-6">
              <div className="bg-gray-750 p-4 rounded-lg">
                <h4 className="font-medium mb-3">AI-улучшение сигналов</h4>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="font-medium">Глобальное AI-улучшение</div>
                    <div className="text-sm text-gray-400">Применять AI-улучшение ко всем копируемым сигналам</div>
                  </div>
                  <div className="relative inline-block w-12 h-6 rounded-full bg-green-500 cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Минимальная уверенность AI для коррекции</label>
                    <div className="flex items-center">
                      <input 
                        type="range" 
                        min="50" 
                        max="100" 
                        value="75" 
                        className="w-full mr-2" 
                      />
                      <span className="w-8 text-center">75%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gray-700/30 p-3 rounded-lg">
                    <div>
                      <div className="font-medium">Коррекция точек входа</div>
                      <div className="text-sm text-gray-400">Оптимизация точек входа на основе анализа рынка</div>
                    </div>
                    <div className="relative inline-block w-12 h-6 rounded-full bg-green-500 cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gray-700/30 p-3 rounded-lg">
                    <div>
                      <div className="font-medium">Коррекция Stop Loss</div>
                      <div className="text-sm text-gray-400">Настройка уровней Stop Loss на основе структуры рынка</div>
                    </div>
                    <div className="relative inline-block w-12 h-6 rounded-full bg-green-500 cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center bg-gray-700/30 p-3 rounded-lg">
                    <div>
                      <div className="font-medium">Коррекция Take Profit</div>
                      <div className="text-sm text-gray-400">Настройка уровней Take Profit по ключевым уровням</div>
                    </div>
                    <div className="relative inline-block w-12 h-6 rounded-full bg-green-500 cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-750 p-4 rounded-lg">
                <h4 className="font-medium mb-3">Параметры риск-менеджмента</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Максимальный процент баланса на все копирования</label>
                    <div className="flex items-center">
                      <input 
                        type="range" 
                        min="10" 
                        max="100" 
                        value="50" 
                        className="w-full mr-2" 
                      />
                      <span className="w-8 text-center">50%</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Максимальная просадка до остановки копирования</label>
                    <div className="flex items-center">
                      <input 
                        type="range" 
                        min="5" 
                        max="50" 
                        value="15" 
                        className="w-full mr-2" 
                      />
                      <span className="w-8 text-center">15%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                Сохранить настройки
              </button>
            </div>
          </div>
        )}
      </Card>
      
      {/* Модальное окно с деталями трейдера */}
      {selectedTrader && (
        <TraderDetailsModal 
          trader={selectedTrader} 
          onClose={() => {
            setSelectedTrader(null);
            setShowTraderDetails(false);
          }}
          onCopy={handleStartCopying}
        />
      )}
    </div>
  );
};

export default CopyTradingContent;