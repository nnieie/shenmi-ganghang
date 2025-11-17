// 文件名: src/App.tsx
import { useState, useEffect } from 'react';
import { WaveGrid } from './WaveGrid';
import { useWaveModel } from './useWaveModel';
import './styles.css'; // 导入样式

export default function App() {
  // 1. 调用自定义 Hook, 获取计算好的波浪方向、岸线和等深线
  const { grid, coastline, contours } = useWaveModel();

  // 2. 创建一个 state 来控制 A/B 行的显示
  const [showA, setShowA] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(300);

  // 3. 使用 useEffect 设置一个定时器, 循环切换 showA
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(() => {
      // 切换布尔值 (true -> false -> true)
      setShowA(prevShowA => !prevShowA);
    }, speed);

    // React 组件卸载时, 清除定时器, 防止内存泄漏
    return () => clearInterval(intervalId);
  }, [isPlaying, speed]); // 依赖播放状态和速度

  return (
    <div className="App">
      <h1>🌊 海域波浪折射模拟系统</h1>
      <p className="subtitle">基于斯涅尔定律的波浪传播偏转动画</p>
      
      <div className="controls">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="control-btn"
        >
          {isPlaying ? '⏸ 暂停' : '▶️ 播放'}
        </button>
        
        <div className="speed-control">
          <label>动画速度：</label>
          <input 
            type="range" 
            min="100" 
            max="1000" 
            step="50"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          <span>{speed}ms</span>
        </div>
      </div>

      <div className="grid-container">
        <WaveGrid 
          directions={grid} 
          coastline={coastline}
          contours={contours}
          showA={showA} 
        />
      </div>
      
      <div className="legend">
        <h3>图例说明</h3>
        <div className="legend-item">
          <div className="color-box" style={{ background: '#27ae60' }}></div>
          <span>绿色曲线：岸线（凹入的弧形）</span>
        </div>
        <div className="legend-item">
          <div className="color-box" style={{ background: '#e74c3c' }}></div>
          <span>红色曲线：等深线（标注水深）</span>
        </div>
        <div className="legend-item">
          <div className="arrow-demo">→</div>
          <span>箭头：波浪传播方向（颜色表示水深）</span>
        </div>
        <div className="legend-item">
          <span>✨ AB行交替闪烁模拟波浪动态传播</span>
        </div>
      </div>

      <div className="info-panel">
        <h3>原理说明</h3>
        <p>• 波浪从深水区向浅水区传播时，根据<strong>斯涅尔定律</strong>会发生折射</p>
        <p>• 水深越浅，波速越慢，折射角度越大</p>
        <p>• 凹入的岸线会导致波浪能量聚焦</p>
        <p>• AB组交替显示模拟连续的波浪运动</p>
      </div>
    </div>
  );
}
