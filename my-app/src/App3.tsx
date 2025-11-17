// 文件名: src/App3.tsx
// 波浪折射模拟系统主程序
// 基于有限差分法求解波浪折射方程
// 包含海岬（凸出50m）和海湾（凹进10m）的不规则岸线

import { useState } from 'react';
import { useWaveRefractionModel, DEFAULT_CONFIG } from './useWaveRefractionModel';
import { WaveRefractionView } from './WaveRefractionView';
import { solveWaveNumber, solveFromWavelength } from './waveRefraction';
import './styles2.css';

export default function App3() {
  // 用户可输入参数
  const [params, setParams] = useState<{
    h: number;
    T?: number;
    L?: number;
    H: number;
    slope: number;
    bayDepth: number;
    capeExtension: number;
    alpha0: number;
    showWaveRays: boolean;
    showDepthContours: boolean;
    showArrows: boolean;
  }>({
    // 波浪参数（只需输入其中两个，第三个会自动计算）
    h: 20,        // 初始水深 (m)
    T: 8,         // 周期 (s)
    L: undefined, // 波长 (m) - 可选
    H: 2,         // 波高 (m)
    
    // 地形参数
    slope: 0.01,  // 坡度 i (0.01 = 1%)
    bayDepth: 10, // 海湾凹进深度 (m)
    capeExtension: 50, // 岬角凸出距离 (m)
    
    // 初始波向角
    alpha0: 0,    // 深水区入射角 (degrees)
    
    // 显示控制
    showWaveRays: true,
    showDepthContours: true,
    showArrows: true
  });
  
  // 临时参数（用于即时输入）
  const [tempParams, setTempParams] = useState(params);
  
  // 处理失去焦点事件 - 自动计算缺失的参数
  const handleBlur = () => {
    let updatedParams = { ...tempParams };
    
    // 如果 h, T, L 都有值，直接应用
    if (tempParams.h && tempParams.T && tempParams.L) {
      setParams(updatedParams);
      return;
    }
    
    // 根据已有的参数计算缺失的参数
    if (tempParams.h && tempParams.T && !tempParams.L) {
      // 根据 h 和 T 计算 L
      const k = solveWaveNumber(tempParams.h, tempParams.T);
      const L = (2 * Math.PI) / k;
      updatedParams.L = L;
    } else if (tempParams.h && tempParams.L && !tempParams.T) {
      // 根据 h 和 L 计算 T
      const result = solveFromWavelength(tempParams.h, tempParams.L);
      updatedParams.T = result.T;
    } else if (tempParams.T && tempParams.L && !tempParams.h) {
      // 根据 T 和 L 尝试反推 h (这个比较复杂，暂时不实现)
      // 保持原值
    }
    
    setTempParams(updatedParams);
    setParams(updatedParams);
  };
  
  // 处理单个字段的编辑
  const handleFieldChange = (field: 'h' | 'T' | 'L', value: string) => {
    const numValue = value ? Number(value) : undefined;
    setTempParams({
      ...tempParams,
      [field]: numValue
    });
  };
  
  // 调用波浪折射模型
  const { grid, coastline, contours, dispersion, config } = useWaveRefractionModel({
    domainWidth: DEFAULT_CONFIG.domainWidth,
    domainHeight: DEFAULT_CONFIG.domainHeight,
    gridX: DEFAULT_CONFIG.gridX,
    gridY: DEFAULT_CONFIG.gridY,
    h: params.h,
    T: params.T,
    L: params.L,
    H: params.H,
    slope: params.slope,
    bayDepth: params.bayDepth,
    capeExtension: params.capeExtension,
    alpha0: params.alpha0
  });
  
  // 处理重置
  const handleReset = () => {
    const defaultParams = {
      h: 20,
      T: 8,
      L: undefined,
      H: 2,
      slope: 0.01,
      bayDepth: 10,
      capeExtension: 50,
      alpha0: 0,
      showWaveRays: true,
      showDepthContours: true,
      showArrows: true
    };
    setTempParams(defaultParams);
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🌊 海域波浪折射模拟系统</h1>
        <p className="subtitle">基于有限差分法的波浪传播与折射数值模拟 (´ω｀*)</p>
      </header>
      
      <div className="main-content">
        {/* 左侧：可视化视图 */}
        <div className="visualization-panel">
          <WaveRefractionView
            grid={grid}
            coastline={coastline}
            contours={contours}
            dispersion={dispersion}
            config={config}
            showWaveRays={params.showWaveRays}
            showDepthContours={params.showDepthContours}
            showArrows={params.showArrows}
          />
        </div>
        
        {/* 右侧：参数控制面板 */}
        <div className="control-panel">
          <div className="panel-header">
            <h2>⚙️ 参数设置</h2>
            <button 
              className="reset-btn"
              onClick={handleReset}
            >
              🔄 重置默认
            </button>
          </div>
          
          {/* 波浪参数 */}
          <section className="param-section">
            <h3>🌀 波浪参数</h3>
            <p className="hint">
              💡 提示：<strong>h, T, L 三个参数都可编辑</strong>，失去焦点后自动应用<br/>
              输入任意两个参数，第三个会自动计算。也可以手动输入全部三个参数。
            </p>
            
            <div className="param-group">
              <label>初始水深 h (m):</label>
              <input
                type="number"
                value={tempParams.h || ''}
                onChange={(e) => handleFieldChange('h', e.target.value)}
                onBlur={handleBlur}
                step="1"
                min="0.1"
              />
            </div>
            
            <div className="param-group">
              <label>周期 T (s):</label>
              <input
                type="number"
                value={tempParams.T || ''}
                onChange={(e) => handleFieldChange('T', e.target.value)}
                onBlur={handleBlur}
                step="0.1"
                min="0.1"
              />
            </div>
            
            <div className="param-group">
              <label>波长 L (m):</label>
              <input
                type="number"
                value={tempParams.L || ''}
                onChange={(e) => handleFieldChange('L', e.target.value)}
                onBlur={handleBlur}
                step="1"
                min="0.1"
              />
            </div>
            
            <div className="param-group">
              <label>波高 H (m):</label>
              <input
                type="number"
                value={tempParams.H}
                onChange={(e) => setTempParams({...tempParams, H: Number(e.target.value)})}
                onBlur={handleBlur}
                step="0.1"
                min="0.1"
              />
            </div>
          </section>
          
          {/* 地形参数 */}
          <section className="param-section">
            <h3>🏖️ 地形参数</h3>
            
            <div className="param-group">
              <label>海底坡度 i:</label>
              <input
                type="number"
                value={tempParams.slope}
                onChange={(e) => setTempParams({...tempParams, slope: Number(e.target.value)})}
                onBlur={handleBlur}
                step="0.001"
                min="0.001"
                max="0.1"
              />
              <span className="unit">({(tempParams.slope * 100).toFixed(1)}%)</span>
            </div>
            
            <div className="param-group">
              <label>海湾凹进深度 (m):</label>
              <input
                type="number"
                value={tempParams.bayDepth}
                onChange={(e) => setTempParams({...tempParams, bayDepth: Number(e.target.value)})}
                onBlur={handleBlur}
                step="1"
                min="0"
                max="100"
              />
            </div>
            
            <div className="param-group">
              <label>海岬凸出距离 (m):</label>
              <input
                type="number"
                value={tempParams.capeExtension}
                onChange={(e) => setTempParams({...tempParams, capeExtension: Number(e.target.value)})}
                onBlur={handleBlur}
                step="1"
                min="0"
                max="150"
              />
            </div>
            
            <div className="param-group">
              <label>初始波向角 α₀ (°):</label>
              <input
                type="number"
                value={tempParams.alpha0}
                onChange={(e) => setTempParams({...tempParams, alpha0: Number(e.target.value)})}
                onBlur={handleBlur}
                step="5"
                min="-45"
                max="45"
              />
            </div>
          </section>
          
          {/* 显示选项 */}
          <section className="param-section">
            <h3>👁️ 显示选项</h3>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempParams.showWaveRays}
                  onChange={(e) => {
                    setTempParams({...tempParams, showWaveRays: e.target.checked});
                    handleBlur();
                  }}
                />
                <span>显示波峰线和波向线</span>
              </label>
            </div>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempParams.showDepthContours}
                  onChange={(e) => {
                    setTempParams({...tempParams, showDepthContours: e.target.checked});
                    handleBlur();
                  }}
                />
                <span>显示等深线</span>
              </label>
            </div>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={tempParams.showArrows}
                  onChange={(e) => {
                    setTempParams({...tempParams, showArrows: e.target.checked});
                    handleBlur();
                  }}
                />
                <span>显示波向箭头</span>
              </label>
            </div>
          </section>
          
          {/* 计算结果显示 */}
          <section className="result-section">
            <h3>📊 计算结果</h3>
            <div className="result-grid">
              <div className="result-item">
                <span className="label">波长 L:</span>
                <span className="value">{dispersion.L.toFixed(2)} m</span>
              </div>
              <div className="result-item">
                <span className="label">周期 T:</span>
                <span className="value">{dispersion.T.toFixed(2)} s</span>
              </div>
              <div className="result-item">
                <span className="label">波速 C:</span>
                <span className="value">{dispersion.C.toFixed(2)} m/s</span>
              </div>
              <div className="result-item">
                <span className="label">波数 k:</span>
                <span className="value">{dispersion.k.toFixed(4)} rad/m</span>
              </div>
            </div>
          </section>
          
          {/* 原理说明 */}
          <section className="info-section">
            <h3>📚 原理说明</h3>
            <ul>
              <li><strong>色散方程:</strong> σ² = g·k·tanh(k·h)</li>
              <li><strong>缓坡方程:</strong> ∂(k·cosα)/∂y = -∂(k·sinα)/∂x</li>
              <li><strong>有限差分法:</strong> 数值求解波向角的空间分布</li>
              <li><strong>海岬效应:</strong> 波浪能量在凸出处汇聚</li>
              <li><strong>海湾效应:</strong> 波浪能量在凹入处发散</li>
            </ul>
          </section>
        </div>
      </div>
      
      <footer className="app-footer">
        <p>💻 2025秋季学期 · 海洋工程波浪折射数值模拟系统 · 喵~ (´∀｀)♡</p>
      </footer>
    </div>
  );
}
