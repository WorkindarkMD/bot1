import React from 'react';

const Loader = ({ text = "Загрузка..." }) => (
  <div style={{ textAlign: 'center', padding: 24 }}>
    <span>{text}</span>
  </div>
);

export default Loader;
