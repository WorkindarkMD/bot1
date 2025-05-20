import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Zap, Search, Filter, RefreshCw, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Star, AlertCircle, Settings as SettingsIcon, StopCircle } from 'lucide-react';
import Card from '../common/Card';
import Loader from '../common/Loader';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import useApi from '../../hooks/useApi';
import SignalSettingsModal from './SignalSettingsModal';

const DEFAULT_SETTINGS = {
  exchange: 'bitget',
  marketType: 'futures',
  timeframe: '1h',
  productType: 'umcbl',
  limit: 10,
  autoSendToAI: true,
  autoTradeDirect: false,
  patterns: ['HH','LL','HL','LH','CHoCH_BUY','CHoCH_SELL','BOS_BUY','BOS_SELL','EQH','EQL']
};

const SignalsContent = () => {
  // --- Обработчики для кнопок и модального окна ---
  const handleOpenSettings = () => setSettingsOpen(true);

  const handleSaveSettings = (settings) => {
    setSignalSettings(settings);
    setSettingsOpen(false);
  };

  const handleStartScan = async () => {
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch('/api/signals/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signalSettings)
      });
      const data = await res.json();
      if (data.status) {
        setScanStatus(data.status);
      } else {
        setScanError(data.error || 'Ошибка запуска сканирования');
      }
    } catch (err) {
      setScanError('Ошибка соединения с сервером');
    }
    setScanLoading(false);
  };

  const handleStopScan = async () => {
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await fetch('/api/signals/scan/stop', { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setScanStatus(data.status);
      } else {
        setScanError(data.error || 'Ошибка остановки сканирования');
      }
    } catch (err) {
      setScanError('Ошибка соединения с сервером');
    }
    setScanLoading(false);
  };
  // ---
  const signals = useSelector(state => state.signals);
  const isLoading = useSelector(state => state.isLoading);
  const { fetchSignals, executeSignal } = useApi();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterConfidence, setFilterConfidence] = useState(0);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedSignal, setSelectedSignal] = useState(null);
  // --- State for signal scan ---
  const [scanStatus, setScanStatus] = useState({ running: false, generated: 0, total: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signalSettings, setSignalSettings] = useState(DEFAULT_SETTINGS);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState(null);
  // ---
  
  // Периодически обновлять статус сканирования
  useEffect(() => {
    let timer;
    if (scanStatus.running) {
      timer = setInterval(() => {
        fetch('/api/signals/scan/status').then(r=>r.json()).then(res=>{
          if(res.status) setScanStatus(res.status);
        });
      }, 1500);
    }
    return () => timer && clearInterval(timer);
  }, [scanStatus.running]);

  // Загружаем реальные сигналы при монтировании
  useEffect(() => {
    fetchSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автоматически обновлять сигналы после завершения сканирования
  useEffect(() => {
    if (!scanStatus.running) {
      fetchSignals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanStatus.running]);
  
  // Обработчик выполнения сигнала
  const handleExecuteSignal = (signal) => {
    if (window.confirm(`Вы уверены, что хотите исполнить сигнал ${signal.direction} для ${signal.pair}?`)) {
      executeSignal(signal);
    }
  };
  
  // Фильтрация и сортировка сигналов
  const getFilteredSignals = () => {
    // Используем тестовые данные, в реальном приложении здесь был бы signals из redux
    let filtered = Array.isArray(signals) ? signals : [];
    
    // Фильтрация по поисковому запросу
    if (searchTerm) {
      filtered = filtered.filter(signal => 
        signal.pair.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Фильтрация по уверенности
    if (filterConfidence > 0) {
      filtered = filtered.filter(signal => signal.confidence >= filterConfidence / 100);
    }
    
    // Сортировка
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'confidence') {
        return sortOrder === 'asc' ? a.confidence - b.confidence : b.confidence - a.confidence;
      } else if (sortBy === 'timestamp') {
        return sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      } else if (sortBy === 'pair') {
        return sortOrder === 'asc' 
          ? a.pair.localeCompare(b.pair) 
          : b.pair.localeCompare(a.pair);
      }
      return 0;
    });
    
    return filtered;
  };
  
  // Получение статуса сигнала для отображения
  const getSignalStatusBadge = (signal) => {
    switch (signal.status) {
      case 'NEW':
        return <StatusBadge status="info" text="НОВЫЙ" />;
      case 'EXECUTED':
        return <StatusBadge status="success" text="ИСПОЛНЕН" />;
      case 'EXPIRED':
        return <StatusBadge status="warning" text="ИСТЕК" />;
      case 'REJECTED':
        return <StatusBadge status="error" text="ОТКЛОНЕН" />;
      default:
        return <StatusBadge status="info" text={signal.status} />;
    }
  };
  
  // Форматирование времени
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
    
    return 'только что';
  };
  
  const filteredSignals = getFilteredSignals();
  
  // Рендер карточек сигналов
  const renderSignalCards = () => {
    if (isLoading) {
      return <Loader text="Загрузка сигналов..." />;
    }
    
    if (!filteredSignals || filteredSignals.length === 0) {
      return (
        <EmptyState 
          title="Нет активных сигналов"
          description="У вас пока нет активных торговых сигналов. Сигналы от AI-анализатора и копитрейдинга будут отображаться здесь."
          actionText="Запустить AI-анализ"
          onAction={() => {}}
        />
      );
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSignals.map(signal => (
          <Card 
            key={signal.id} 
            padding="small" 
            className="cursor-pointer hover:border hover:border-blue-500 transition-all"
            onClick={() => setSelectedSignal(signal)}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium">{signal.pair}</h4>
                <div className="text-xs text-gray-400 mt-1">
                  {formatTimeSince(signal.timestamp)} • {signal.source === 'ai-analyzer' ? 'AI Анализ' : 'Копитрейдинг'}
                </div>
              </div>
              <div className={`px-2 py-1 text-xs rounded ${
                signal.direction === 'BUY' || signal.direction === 'LONG' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {signal.direction}
              </div>
            </div>
            
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Вход:</span>
                <span className="text-sm font-medium">${signal.entryPoint}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Стоп-лосс:</span>
                <span className="text-sm font-medium text-red-400">${signal.stopLoss}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Тейк-профит:</span>
                <span className="text-sm font-medium text-green-400">${signal.takeProfit}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Star size={14} className="text-yellow-400 mr-1" />
                <div className="h-1 w-16 bg-gray-700 rounded-full overflow-hidden mr-1">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" 
                    style={{width: `${signal.confidence * 100}%`}}
                  ></div>
                </div>
                <span className="text-xs text-gray-300">{Math.round(signal.confidence * 100)}%</span>
              </div>
              {getSignalStatusBadge(signal)}
            </div>
          </Card>
        ))}
      </div>
    );
  };
  
  // Модальное окно с деталями сигнала
  const SignalDetailsModal = ({ signal, onClose, onExecute }) => {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-gray-700 p-4">
            <h2 className="text-xl font-bold flex items-center">
              Сигнал {signal.pair}
              <span className={`ml-2 text-sm px-2 py-0.5 rounded ${
                signal.direction === 'BUY' || signal.direction === 'LONG' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {signal.direction}
              </span>
            </h2>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400">Источник:</div>
                <div>
                  {signal.source === 'ai-analyzer' ? (
                    <span className="text-blue-400 flex items-center">
                      <Zap size={14} className="mr-1" /> 
                      AI Анализ
                    </span>
                  ) : (
                    <span className="text-purple-400 flex items-center">
                      <RefreshCw size={14} className="mr-1" /> 
                      Копитрейдинг
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400">Время сигнала:</div>
                <div>{new Date(signal.timestamp).toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400">Статус:</div>
                <div>{getSignalStatusBadge(signal)}</div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400">Уверенность AI:</div>
                <div className="flex items-center">
                  <div className="h-2 w-24 bg-gray-700 rounded-full overflow-hidden mr-1">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" 
                      style={{width: `${signal.confidence * 100}%`}}
                    ></div>
                  </div>
                  <span className="text-green-400">{Math.round(signal.confidence * 100)}%</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6 bg-gray-750 p-4 rounded-lg">
              <h3 className="font-medium mb-3">Уровни входа и выхода</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Точка входа:</span>
                  <span className="font-medium">${signal.entryPoint}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Стоп-лосс:</span>
                  <span className="font-medium text-red-400">${signal.stopLoss}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Тейк-профит:</span>
                  <span className="font-medium text-green-400">${signal.takeProfit}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Соотношение риск/прибыль:</span>
                  <span className="font-medium text-yellow-400">
                    1:{((signal.takeProfit - signal.entryPoint) / (signal.entryPoint - signal.stopLoss)).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="font-medium mb-3">Анализ</h3>
              <p className="text-gray-300 text-sm">{signal.analysis}</p>
            </div>
            
            {signal.status === 'NEW' && (
              <div className="flex justify-end">
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
                  onClick={() => onExecute(signal)}
                >
                  <Zap size={16} className="mr-2" />
                  Исполнить сигнал
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="p-6 w-full h-full overflow-y-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Торговые сигналы</h1>
          <p className="text-gray-400">Управление сигналами от AI-анализатора и копитрейдинга</p>
        </div>
        <div className="flex space-x-2">
          {scanStatus.running ? (
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center" onClick={scanLoading ? undefined : handleStopScan} disabled={scanLoading}>
              <StopCircle size={16} className="mr-2" />
              Стоп поиск
            </button>
          ) : (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center" onClick={scanLoading ? undefined : handleStartScan} disabled={scanLoading}>
              <Zap size={16} className="mr-2" />
              Запустить поиск
            </button>
          )}
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg flex items-center" onClick={handleOpenSettings}>
            <SettingsIcon size={16} className="mr-1" />
            Настройки
          </button>
        </div>
      </div>
      {scanError && <div className="text-red-500 mb-2">Ошибка: {scanError}</div>}
      {scanStatus.running && (
        <div className="mb-4 text-blue-400">Поиск сигналов: найдено {scanStatus.generated} из {scanStatus.total}</div>
      )}
      <SignalSettingsModal 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        onSave={handleSaveSettings}
        initialSettings={signalSettings}
      />
      {/* Панель фильтров */}
      <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Поиск сигналов..." 
              className="w-full bg-gray-700 text-white pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Минимальная уверенность</label>
            <div className="flex items-center">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(parseInt(e.target.value))}
                className="w-full mr-2" 
              />
              <span className="w-10 text-center">{filterConfidence}%</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <select 
              className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 flex-grow"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="timestamp">По времени</option>
              <option value="confidence">По уверенности</option>
              <option value="pair">По паре</option>
            </select>
            <button 
              className="bg-gray-700 px-3 py-2 rounded-lg border border-gray-600"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </button>
          </div>
        </div>
      </div>
      {/* Карточки сигналов */}
          onClose={() => setSelectedSignal(null)}
          onExecute={handleExecuteSignal}
        />
      )}
    </div>
  );
};

export default SignalsContent;