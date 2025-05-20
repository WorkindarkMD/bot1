import React from 'react';

const Card = ({ children, ...props }) => (
  <div {...props} style={{ background: '#222', borderRadius: 8, padding: 16 }}>
    {children}
  </div>
);

export default Card;
