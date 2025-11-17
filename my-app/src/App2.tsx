// 文件名: src/App2.tsx
import { useState } from 'react';
import { useWaveRefractionModel, DEFAULT_CONFIG, type ModelConfig } from './useWaveRefractionModel';
import { WaveRefractionView } from './WaveRefractionView';
import './styles2.css';

export default function App2() {
  // 参数状态
  const [slope, setSlope] = useState(DEFAULT_CONFIG.slope);
  const [waveHeight, setWaveHeight] = useState(DEFAULT_CONFIG.H);
  const [initialDepth, setInitialDepth] = useState(DEFAULT_CONFIG.h);
  const [period, setPeriod] = useState(DEFAULT_CONFIG.T);
  const [wavelength, setWavelength] = useState<number | undefined>(undefined);
  const [alpha0, setAlpha0] = useState(DEFAULT_CONFIG.alpha0);
  const [inputMode, setInputMode] = useState<'period' | 'wavelength'>('period');
  
  // 可视化选项
  const [showWaveRays, setShowWaveRays] = useState(true);
  const [showDepthContours, setShowDepthContours] = useState(true);
  const [showArrows, setShowArrows] = useState(false); // 默认关闭箭头

  // 构建配置
  const config: Partial<ModelConfig> = {
    slope,
    H: waveHeight,
    h: initialDepth,
    alpha0,
    ...(inputMode === 'period' ? { T: period } : { L: wavelength })
  };

  // 计算模型
  const { grid, coastline, contours, dispersion, config: fullConfig } = useWaveRefractionModel(config);

  return (
    <div className="app2-container">
      <header className="app2-header">
        <h1>🌊 波浪折射模拟系统</h1>
        <p className="subtitle">基于有限差分法求解波向角场</p>
      </header>

      <div className="main-content">
        {/* 左侧参数面板 */}
        <aside className="parameter-panel">
          <h3>🎛️ 参数设置</h3>
          
          {/* 地形参数 */}
          <section className="param-section">
            <h4>📐 地形参数</h4>
            
            <div className="param-item">
              <label>
                海底坡度 i:
                <input
                  type="number"
                  value={slope}
                  onChange={(e) => setSlope(Number(e.target.value))}
                  step="0.001"
                  min="0.001"
                  max="0.1"
                />
              </label>
              <span className="param-hint">tan(θ), 推荐: 0.01</span>
            </div>

            <div className="param-info">
              <p>✓ 海湾凹进: 10m</p>
              <p>✓ 岬角凸出: 50m</p>
            </div>
          </section>

          {/* 波浪参数 */}
          <section className="param-section">
            <h4>🌊 波浪参数</h4>
            
            <div className="param-item">
              <label>
                波高 H (m):
                <input
                  type="number"
                  value={waveHeight}
                  onChange={(e) => setWaveHeight(Number(e.target.value))}
                  step="0.5"
                  min="0.5"
                  max="10"
                />
              </label>
            </div>

            <div className="param-item">
              <label>
                初始水深 h (m):
                <input
                  type="number"
                  value={initialDepth}
                  onChange={(e) => setInitialDepth(Number(e.target.value))}
                  step="1"
                  min="5"
                  max="100"
                />
              </label>
            </div>

            <div className="param-item">
              <label>
                <input
                  type="radio"
                  checked={inputMode === 'period'}
                  onChange={() => setInputMode('period')}
                />
                周期 T (s):
              </label>
              <input
                type="number"
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
                step="0.5"
                min="3"
                max="20"
                disabled={inputMode !== 'period'}
              />
            </div>

            <div className="param-item">
              <label>
                <input
                  type="radio"
                  checked={inputMode === 'wavelength'}
                  onChange={() => setInputMode('wavelength')}
                />
                波长 L (m):
              </label>
              <input
                type="number"
                value={wavelength || ''}
                onChange={(e) => setWavelength(Number(e.target.value))}
                step="10"
                min="10"
                max="500"
                disabled={inputMode !== 'wavelength'}
                placeholder="可选"
              />
            </div>

            <div className="param-item">
              <label>
                初始波向角 α₀ (°):
                <input
                  type="number"
                  value={alpha0}
                  onChange={(e) => setAlpha0(Number(e.target.value))}
                  step="5"
                  min="-45"
                  max="45"
                />
              </label>
              <span className="param-hint">0°=垂直入射</span>
            </div>
          </section>

          {/* 可视化选项 */}
          <section className="param-section">
            <h4>👁️ 显示选项</h4>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showWaveRays}
                onChange={(e) => setShowWaveRays(e.target.checked)}
              />
              波峰线 & 波向线
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showDepthContours}
                onChange={(e) => setShowDepthContours(e.target.checked)}
              />
              等深线
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showArrows}
                onChange={(e) => setShowArrows(e.target.checked)}
              />
              波向箭头（辅助）
            </label>
          </section>

          {/* 公式说明 */}
          <section className="param-section formula-section">
            <h4>📚 核心公式</h4>
            <div className="formula">
              <p><strong>色散关系:</strong></p>
              <p>σ² = g·k·tanh(k·h)</p>
            </div>
            <div className="formula">
              <p><strong>控制方程:</strong></p>
              <p>∂(k·cosα)/∂y = -∂(k·sinα)/∂x</p>
            </div>
          </section>
        </aside>

        {/* 右侧可视化区域 */}
        <main className="visualization-area">
          <WaveRefractionView
            grid={grid}
            coastline={coastline}
            contours={contours}
            dispersion={dispersion}
            config={fullConfig}
            showWaveRays={showWaveRays}
            showDepthContours={showDepthContours}
            showArrows={showArrows}
          />

          {/* 说明文本 */}
          <div className="explanation">
            <h4>📖 说明</h4>
            <ul>
              <li><strong>绿色线</strong>: 海岸线（包含海湾和岬角）</li>
              <li><strong>红色虚线</strong>: 等深线（标注水深值）</li>
              <li><strong>金色曲线</strong>: 波浪线（波峰线的传播路径）</li>
              <li><strong>蓝色箭头</strong>: 各点的波向角方向</li>
              <li><strong>物理效应</strong>: 波浪从深水向浅水传播时，由于波速变化，发生折射</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
