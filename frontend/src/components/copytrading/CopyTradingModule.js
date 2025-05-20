import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import useApi from '../../hooks/useApi';

// Модуль для отображения и управления копитрейдинг-сигналами
export default function CopyTradingModule() {
  const api = useApi();
  const traders = useSelector(state => state.traders || []);
  const isLoading = useSelector(state => state.isLoading);
  const error = useSelector(state => state.error);

  useEffect(() => {
    api.fetchTraders();
  }, []);

  const handleRefresh = () => {
    api.fetchTraders();
  };

  const handleStartCopy = (traderId) => {
    if (window.confirm('Начать копирование этого трейдера?')) {
      api.startCopyTrading({ traderId });
    }
  };

  const handleStopCopy = (traderId) => {
    if (window.confirm('Остановить копирование этого трейдера?')) {
      api.stopCopyTrading(traderId);
    }
  };

  return (
    <div>
      <h2>Копитрейдинг — трейдеры</h2>
      <button onClick={handleRefresh} style={{marginBottom:12, padding:'6px 16px', borderRadius:6, background:'#1976d2', color:'#fff', border:'none', cursor:'pointer'}}>Обновить</button>
      {isLoading && <div>Загрузка...</div>}
      {error && <div style={{color:'red'}}>Ошибка: {error}</div>}
      <div>
        {traders.map(trader => (
          <CopyTraderCard key={trader.id} trader={trader} onStartCopy={handleStartCopy} onStopCopy={handleStopCopy} />
        ))}
      </div>
    </div>
  );
}

function CopyTraderCard({ trader, onStartCopy, onStopCopy }) {
  return (
    <div className="signal-card" style={{border:'1px solid #6cf',margin:'10px',padding:'10px',borderRadius:8,background:'#f9fcff'}}>
      <div><b>{trader.name || trader.id}</b> <span style={{color:'#0097a7', fontSize:'0.9em'}}>[Трейдер]</span></div>
      <div>Биржа: <b>{trader.exchange}</b></div>
      <div>Стратегия: <b>{trader.tradingStyle || '-'}</b></div>
      <div>Уверенность AI: <b>{trader.aiScore ? trader.aiScore + '%' : '-'}</b></div>
      <div>Сделок: <b>{trader.totalTrades || '-'}</b> | WinRate: <b>{trader.winRate || '-'}%</b></div>
      <div>ROI: <b>{trader.roi || '-'}</b></div>
      <div style={{marginTop:8}}>
        {trader.isCopying ? (
          <button onClick={() => onStopCopy(trader.id)} style={{margin:'8px 0', padding:'6px 14px', borderRadius:6, background:'#e53935', color:'#fff', border:'none', cursor:'pointer'}}>Остановить копирование</button>
        ) : (
          <button onClick={() => onStartCopy(trader.id)} style={{margin:'8px 0', padding:'6px 14px', borderRadius:6, background:'#43a047', color:'#fff', border:'none', cursor:'pointer'}}>Начать копировать</button>
        )}
      </div>
      <details style={{marginTop:8}}>
        <summary>Описание</summary>
        <div style={{whiteSpace:'pre-wrap',fontSize:'0.96em'}}>{trader.description || 'Нет описания'}</div>
      </details>
    </div>
  );
}

// Используем ту же визуализацию стакана, что и в SignalsModule
function SignalVisualization({ visualization, direction }) {
  if (!visualization) return null;
  const { orderBookWalls = [] } = visualization;
  return (
    <div style={{position:'relative',height:60,marginBottom:8}}>
      {orderBookWalls.map((wall,i) => (
        <OrderBookWallTriangle key={i} wall={wall} direction={direction} idx={i} />
      ))}
    </div>
  );
}

function OrderBookWallTriangle({ wall, direction, idx }) {
  const isSell = wall.side === 'sell';
  const triangle = isSell ? '▲' : '▼';
  const color = wall.isDuplicate ? '#ff9800' : (isSell ? '#e53935' : '#00897b');
  const top = 8 + idx*16;
  return (
    <div style={{position:'absolute',left: isSell ? '70%' : '20%', top: top}}>
      <span style={{fontSize:22,color,fontWeight:'bold'}}>{triangle}</span>
      <div style={{fontSize:12,color:'#333',textAlign:'center'}}>{wall.size}</div>
      {wall.isDuplicate && <div style={{fontSize:10,color:'#ff9800'}}>Дубликат</div>}
    </div>
  );
}
