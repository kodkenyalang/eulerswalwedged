import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { riskService } from '../services/riskService';

const RiskChart = ({ poolId }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [riskData, setRiskData] = useState(null);
  const [timeframe, setTimeframe] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (poolId) {
      loadRiskData();
    }
    
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [poolId, timeframe]);

  useEffect(() => {
    if (riskData && chartRef.current) {
      renderChart();
    }
  }, [riskData]);

  const loadRiskData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await riskService.getPoolRiskHistory(poolId, timeframe);
      setRiskData(data);
    } catch (err) {
      console.error('Error loading risk data:', err);
      setError('Failed to load risk data');
      // Generate mock data for demonstration
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const days = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
    const intervals = timeframe === '24h' ? 24 : days;
    
    const mockData = {
      timestamps: [],
      riskScores: [],
      volatility: [],
      impermanentLoss: [],
      correlationRisk: [],
      liquidityRisk: []
    };

    const now = Date.now();
    const intervalMs = timeframe === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    for (let i = intervals - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      mockData.timestamps.push(timestamp);
      
      // Generate realistic risk data with some correlation
      const baseRisk = 3000 + Math.sin(i * 0.5) * 1000;
      const volatility = 2000 + Math.random() * 2000;
      const impermanentLoss = 1000 + Math.random() * 3000;
      const correlation = 1500 + Math.random() * 1000;
      const liquidity = 500 + Math.random() * 1500;
      
      mockData.riskScores.push(Math.max(0, Math.min(10000, baseRisk + (Math.random() - 0.5) * 1000)));
      mockData.volatility.push(volatility);
      mockData.impermanentLoss.push(impermanentLoss);
      mockData.correlationRisk.push(correlation);
      mockData.liquidityRisk.push(liquidity);
    }

    setRiskData(mockData);
  };

  const renderChart = () => {
    if (!chartRef.current || !riskData) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    const labels = riskData.timestamps.map(timestamp => {
      const date = new Date(timestamp);
      if (timeframe === '24h') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Overall Risk Score',
            data: riskData.riskScores.map(score => score / 100), // Convert to percentage
            borderColor: '#5352ed',
            backgroundColor: 'rgba(83, 82, 237, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Volatility Risk',
            data: riskData.volatility.map(vol => vol / 100),
            borderColor: '#ff4757',
            backgroundColor: 'rgba(255, 71, 87, 0.1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.4
          },
          {
            label: 'Impermanent Loss Risk',
            data: riskData.impermanentLoss.map(il => il / 100),
            borderColor: '#ffa502',
            backgroundColor: 'rgba(255, 165, 2, 0.1)',
            borderWidth: 2,
            borderDash: [10, 5],
            fill: false,
            tension: 0.4
          },
          {
            label: 'Liquidity Risk',
            data: riskData.liquidityRisk.map(lr => lr / 100),
            borderColor: '#2ed573',
            backgroundColor: 'rgba(46, 213, 115, 0.1)',
            borderWidth: 2,
            pointStyle: 'circle',
            pointRadius: 3,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          title: {
            display: true,
            text: `Risk Analysis - Pool #${poolId}`,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: 20
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#5352ed',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time',
              font: {
                weight: 'bold'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Risk Score (%)',
              font: {
                weight: 'bold'
              }
            },
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        elements: {
          point: {
            radius: 3,
            hoverRadius: 6
          }
        }
      }
    });
  };

  const getRiskLevel = (score) => {
    if (score > 5000) return { level: 'High', color: '#ff4757' };
    if (score > 3000) return { level: 'Medium', color: '#ffa502' };
    return { level: 'Low', color: '#2ed573' };
  };

  const getCurrentRisk = () => {
    if (!riskData || riskData.riskScores.length === 0) return 0;
    return riskData.riskScores[riskData.riskScores.length - 1];
  };

  const currentRisk = getCurrentRisk();
  const riskLevel = getRiskLevel(currentRisk);

  if (loading) {
    return (
      <div className="risk-chart-container">
        <div className="chart-header">
          <h3>Risk Analysis</h3>
        </div>
        <div className="loading-chart">
          <div className="loading-spinner"></div>
          <p>Loading risk data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-chart-container">
        <div className="chart-header">
          <h3>Risk Analysis</h3>
        </div>
        <div className="error-chart">
          <p>❌ {error}</p>
          <button onClick={loadRiskData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="risk-chart-container">
      <div className="chart-header">
        <h3>Risk Analysis</h3>
        <div className="chart-controls">
          <div className="timeframe-selector">
            {['24h', '7d', '30d'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="current-risk-summary">
        <div className="risk-metric">
          <span className="metric-label">Current Risk Level:</span>
          <span 
            className="metric-value"
            style={{ color: riskLevel.color }}
          >
            {riskLevel.level} ({(currentRisk / 100).toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="chart-wrapper">
        <canvas ref={chartRef} width="800" height="400"></canvas>
      </div>

      {riskData && (
        <div className="risk-breakdown">
          <h4>Risk Components (Current)</h4>
          <div className="risk-components">
            <div className="risk-component">
              <div className="component-header">
                <span className="component-name">Volatility Risk</span>
                <span className="component-value">
                  {(riskData.volatility[riskData.volatility.length - 1] / 100).toFixed(2)}%
                </span>
              </div>
              <div className="component-bar">
                <div 
                  className="component-fill"
                  style={{ 
                    width: `${riskData.volatility[riskData.volatility.length - 1] / 100}%`,
                    backgroundColor: '#ff4757'
                  }}
                ></div>
              </div>
            </div>

            <div className="risk-component">
              <div className="component-header">
                <span className="component-name">Impermanent Loss Risk</span>
                <span className="component-value">
                  {(riskData.impermanentLoss[riskData.impermanentLoss.length - 1] / 100).toFixed(2)}%
                </span>
              </div>
              <div className="component-bar">
                <div 
                  className="component-fill"
                  style={{ 
                    width: `${riskData.impermanentLoss[riskData.impermanentLoss.length - 1] / 100}%`,
                    backgroundColor: '#ffa502'
                  }}
                ></div>
              </div>
            </div>

            <div className="risk-component">
              <div className="component-header">
                <span className="component-name">Correlation Risk</span>
                <span className="component-value">
                  {(riskData.correlationRisk[riskData.correlationRisk.length - 1] / 100).toFixed(2)}%
                </span>
              </div>
              <div className="component-bar">
                <div 
                  className="component-fill"
                  style={{ 
                    width: `${riskData.correlationRisk[riskData.correlationRisk.length - 1] / 100}%`,
                    backgroundColor: '#5352ed'
                  }}
                ></div>
              </div>
            </div>

            <div className="risk-component">
              <div className="component-header">
                <span className="component-name">Liquidity Risk</span>
                <span className="component-value">
                  {(riskData.liquidityRisk[riskData.liquidityRisk.length - 1] / 100).toFixed(2)}%
                </span>
              </div>
              <div className="component-bar">
                <div 
                  className="component-fill"
                  style={{ 
                    width: `${riskData.liquidityRisk[riskData.liquidityRisk.length - 1] / 100}%`,
                    backgroundColor: '#2ed573'
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="risk-insights">
        <h4>📊 Risk Insights</h4>
        <div className="insights-list">
          {currentRisk > 7000 && (
            <div className="insight warning">
              ⚠️ High risk detected. Consider reducing position size or increasing hedging.
            </div>
          )}
          {currentRisk < 2000 && (
            <div className="insight success">
              ✅ Low risk environment. Good opportunity for larger positions.
            </div>
          )}
          {riskData.volatility[riskData.volatility.length - 1] > 5000 && (
            <div className="insight info">
              📈 High volatility detected. Monitor closely for hedging opportunities.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskChart;
