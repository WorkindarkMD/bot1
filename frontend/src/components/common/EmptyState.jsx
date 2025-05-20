import React from 'react';

const EmptyState = ({ title, description, actionText, onAction }) => (
  <div style={{ textAlign: 'center', padding: 32 }}>
    <h3>{title}</h3>
    <p>{description}</p>
    {actionText && <button onClick={onAction}>{actionText}</button>}
  </div>
);

export default EmptyState;
