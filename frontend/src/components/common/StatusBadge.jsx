import React from 'react';

const StatusBadge = ({ status, text }) => (
  <span style={{
    padding: '2px 8px',
    borderRadius: 12,
    background: status === 'success' ? '#4ade80' :
                status === 'error' ? '#f87171' :
                status === 'warning' ? '#facc15' :
                '#60a5fa',
    color: '#222',
    fontSize: 12
  }}>
    {text}
  </span>
);

export default StatusBadge;
