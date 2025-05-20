import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import useApi from '../../hooks/useApi';

// Визуализация торговых сигналов с анализом стакана и объяснением
export default function SignalsModule() {
  const api = useApi();
  const signals = useSelector(state => state.signals || []);
  const isLoading = useSelector(state => state.isLoading);
  const error = useSelector(state => state.error);

  useEffect(() => {
    api.fetchSignals();
  }, []);

  const handleRefresh = () => {
    api.fetchSignals();
  };

  const handleExecute = (signalId) => {
    if (window.confirm('Вы уверены, что хотите исполнить этот сигнал?')) {
      api.executeSignal(signalId);
    }
  };

  return (
    <div>
      <h2>Торговые сигналы</h2>
      <button onClick={handleRefresh} style={{marginBottom:12, padding:'6px 16px', borderRadius:6, background:'#1976d2', color:'#fff', border:'none', cursor:'pointer'}}>Обновить</button>
      {isLoading && <div>Загрузка...</div>}
      {error && <div style={{color:'red'}}>Ошибка: {error}</div>}
      <div>
        {signals.map(signal => (
          <SignalCard key={signal.id} signal={signal} onExecute={handleExecute} />
        ))}
      </div>
    </div>
  );
}

function SignalCard({ signal, onExecute }) {
  return (
    <div className="signal-card" style={{border:'1px solid #ccc',margin:'10px',padding:'10px',borderRadius:8}}>
      <div><b>{signal.pair}</b> <span style={{color:signal.direction==='BUY'?'green':'red'}}>{signal.direction === 'BUY' ? 'Покупка' : 'Продажа'}</span></div>
      <div>Вход: <b>{signal.entryPoint}</b> | Стоп-лосс: <b>{signal.stopLoss}</b> | Тейк-профит: <b>{signal.takeProfit}</b></div>
      <div>Уверенность: <b>{(signal.confidence*100).toFixed(1)}%</b></div>
      <div style={{fontSize:'0.95em',color:'#888'}}>Источник: {signal.source || 'сканер'}</div>
      <div style={{marginTop:8}}>
        <SignalVisualization visualization={signal.visualization} direction={signal.direction} />
      </div>
      {signal.status === 'NEW' && (
        <button onClick={() => onExecute(signal.id)} style={{margin:'8px 0', padding:'6px 14px', borderRadius:6, background:'#43a047', color:'#fff', border:'none', cursor:'pointer'}}>Исполнить</button>
      )}
      <details style={{marginTop:8}}>
        <summary>Объяснение и журнал</summary>
        <div style={{whiteSpace:'pre-wrap',fontSize:'0.96em'}}>{signal.reasoning}</div>
        {signal.log && signal.log.length > 0 && (
          <div style={{marginTop:8}}>
            <b>Журнал:</b>
            <ul style={{fontSize:'0.95em'}}>
              {signal.log.map((l,i)=>(<li key={i}>{l.step}: {l.info || l.error}</li>))}
            </ul>
          </div>
        )}
      </details>
    </div>
  );
}

function SignalVisualization({ visualization, direction }) {
  if (!visualization) return null;
  const { orderBookWalls = [] } = visualization;
  return (
    <div style={{position:'relative',height:60,marginBottom:8}}>
      {/* Визуализация крупных заявок стакана */}
      {orderBookWalls.map((wall,i) => (
        <OrderBookWallTriangle key={i} wall={wall} direction={direction} idx={i} />
      ))}
    </div>
  );
}

function OrderBookWallTriangle({ wall, direction, idx }) {
  // Для sell — ▲ красный, для buy — ▼ синий/зелёный
  const isSell = wall.side === 'sell';
  const triangle = isSell ? '▲' : '▼';
  const color = wall.isDuplicate ? '#ff9800' : (isSell ? '#e53935' : '#00897b');
  // Смещение по вертикали для визуального разделения
  const top = 8 + idx*16;
  return (
    <div style={{position:'absolute',left: isSell ? '70%' : '20%', top: top}}>
      <span style={{fontSize:22,color,fontWeight:'bold'}}>{triangle}</span>
      <div style={{fontSize:12,color:'#333',textAlign:'center'}}>{wall.size}</div>
      {wall.isDuplicate && <div style={{fontSize:10,color:'#ff9800'}}>Дубликат</div>}
    </div>
  );
}
