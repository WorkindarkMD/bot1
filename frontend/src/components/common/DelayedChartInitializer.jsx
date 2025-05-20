// src/components/common/DelayedChartInitializer.jsx
import React, { useEffect, useState, useRef } from 'react';

/**
 * Компонент для отложенной инициализации графиков
 * Решает проблему с DOM-элементами, которые не успевают полностью подготовиться
 * к моменту инициализации ApexCharts
 * 
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Дочерний компонент (график)
 * @param {number} props.delay - Задержка инициализации в мс (по умолчанию 200)
 * @param {Function} props.onReady - Коллбэк, вызываемый когда компонент готов
 * @returns {React.ReactNode}
 */
const DelayedChartInitializer = ({ 
  children, 
  delay = 200, 
  onReady = null,
  chartRef = null,
  ...props 
}) => {
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef(null);
  
  // Состояние для отслеживания размеров контейнера
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Применяем задержку для гарантированной готовности DOM-элементов
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setContainerSize({ width: offsetWidth, height: offsetHeight });
        
        // Если контейнер имеет ненулевые размеры, устанавливаем готовность
        if (offsetWidth > 0 && offsetHeight > 0) {
          console.log(`Контейнер графика готов: ${offsetWidth}x${offsetHeight}`);
          setIsReady(true);
          
          // Вызываем коллбэк готовности
          if (typeof onReady === 'function') {
            onReady();
          }
          
          // Если есть chartRef с методом forceRender, вызываем его
          if (chartRef && chartRef.current && typeof chartRef.current.forceRender === 'function') {
            console.log('Вызываем forceRender в chartRef');
            chartRef.current.forceRender();
          }
        } else {
          console.log(`Контейнер графика имеет нулевые размеры: ${offsetWidth}x${offsetHeight}`);
          
          // Если контейнер имеет нулевые размеры, пробуем еще раз через повышенную задержку
          const retryTimer = setTimeout(() => {
            if (containerRef.current) {
              const { offsetWidth, offsetHeight } = containerRef.current;
              setContainerSize({ width: offsetWidth, height: offsetHeight });
              
              if (offsetWidth > 0 && offsetHeight > 0) {
                console.log(`Контейнер графика готов после повторной попытки: ${offsetWidth}x${offsetHeight}`);
                setIsReady(true);
                
                if (typeof onReady === 'function') {
                  onReady();
                }
                
                // Вызываем forceRender если доступен
                if (chartRef && chartRef.current && typeof chartRef.current.forceRender === 'function') {
                  console.log('Вызываем forceRender в chartRef после повторной попытки');
                  chartRef.current.forceRender();
                }
              } else {
                console.warn('Контейнер графика не готов даже после повторной попытки');
                
                // Всё равно устанавливаем готовность, чтобы не блокировать рендеринг
                setIsReady(true);
              }
            }
          }, 500); // Увеличенная задержка для повторной попытки
          
          return () => clearTimeout(retryTimer);
        }
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [delay, onReady, chartRef]);
  
  // Отображаем компонент-обертку, который будет содержать дочерний компонент
  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ position: 'relative' }}
      {...props}
    >
      {isReady && children}
      
      {!isReady && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-500 border-t-transparent"></div>
            <p className="mt-2 text-gray-500">Инициализация графика...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelayedChartInitializer;