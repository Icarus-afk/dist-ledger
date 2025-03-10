import React, { useRef, useEffect } from 'react';
// Note: You'll need to install Chart.js
// npm install chart.js

/**
 * Chart component for data visualization using Chart.js
 * 
 * @param {Object} props
 * @param {Array} props.data - Array of data objects to visualize
 * @param {string} props.type - Chart type ('line', 'bar', 'pie', 'doughnut', 'area')
 * @param {string} props.xKey - Key in data objects for X axis values
 * @param {string} props.yKey - Key in data objects for Y axis values
 * @param {string} props.color - Primary color for the chart
 * @param {string} props.title - Optional chart title
 * @param {boolean} props.showLegend - Whether to show legend
 * @param {string} props.height - Chart height
 * @param {Object} props.options - Additional chart configuration options
 */
const Chart = ({ 
  data = [], 
  type = 'line',
  xKey = 'date',
  yKey = 'value',
  color = '#4F46E5',
  title,
  showLegend = true,
  height = '300px',
  options = {},
  className = '',
  ...props 
}) => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  
  // Adjust type for Chart.js specific types
  const getChartType = () => {
    if (type === 'area') {
      return 'line'; // 'area' is actually a line chart with fill
    }
    return type;
  };

  useEffect(() => {
    // Import Chart.js dynamically to avoid SSR issues
    const initChart = async () => {
      if (canvasRef.current) {
        const Chart = (await import('chart.js')).default;
        
        // Register required controllers & elements
        const { 
          LineController, BarController, PieController, DoughnutController,
          LinearScale, CategoryScale, PointElement, LineElement, ArcElement, BarElement,
          Legend, Title, Tooltip
        } = await import('chart.js');
        
        Chart.register(
          LineController, BarController, PieController, DoughnutController,
          LinearScale, CategoryScale, PointElement, LineElement, ArcElement, BarElement,
          Legend, Title, Tooltip
        );

        // Prepare data for Chart.js
        const labels = data.map(item => item[xKey]);
        const values = data.map(item => item[yKey]);
        const chartType = getChartType();

        // Set chart data based on chart type
        const chartData = {
          labels,
          datasets: [{
            label: options.legendLabel || yKey,
            data: values,
            backgroundColor: type === 'line' || type === 'area' ? 'rgba(79, 70, 229, 0.1)' : color,
            borderColor: color,
            borderWidth: 2,
            fill: type === 'area',
            tension: 0.4,
            pointBackgroundColor: color,
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        };

        // Configure chart options
        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: showLegend,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                boxWidth: 6
              }
            },
            title: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              titleColor: '#262626',
              bodyColor: '#525252',
              borderColor: '#e5e5e5',
              borderWidth: 1,
              padding: 10,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                // You can customize tooltips here
              }
            }
          },
          scales: chartType !== 'pie' && chartType !== 'doughnut' ? {
            x: {
              grid: {
                display: false,
                drawBorder: false
              },
              ticks: {
                color: '#737373'
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: '#f5f5f5'
              },
              ticks: {
                color: '#737373'
              }
            }
          } : undefined,
          ...options
        };

        // Destroy existing chart if it exists
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        // Create new chart
        chartInstanceRef.current = new Chart(canvasRef.current, {
          type: chartType,
          data: chartData,
          options: chartOptions
        });
      }
    };

    initChart();

    // Cleanup function
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, type, xKey, yKey, color, options, showLegend, getChartType]);

  return (
    <div 
      ref={chartRef}
      className={`w-full rounded-lg border border-neutral-200 bg-white ${className}`} 
      style={{ height }}
      {...props}
    >
      {title && (
        <div className="px-4 py-3 border-b border-neutral-100">
          <h4 className="text-sm font-medium text-neutral-700">{title}</h4>
        </div>
      )}
      
      <div className="p-4 h-full flex items-center justify-center">
        {data.length === 0 ? (
          <p className="text-neutral-500 text-sm">No data available</p>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
    </div>
  );
};

export default Chart;