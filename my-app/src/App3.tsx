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
  // 默认参数值
  const defaultValues = {
    h: 20,
    T: 8,
    L: undefined as number | undefined,
    H: 2,
    slope: 0.01,
    bayDepth: 10,
    bayWidth: 100,
    capeExtension: 50,
    capeWidth: 200,
    alpha0: 0,
    showWaveRays: true,
    showDepthContours: true,
    showArrows: true,
    rayDensity: 32
  };

  // 用户可输入参数
  const [params, setParams] = useState<{
    h: number;
    T?: number;
    L?: number;
    H: number;
    slope: number;
    bayDepth: number;
    bayWidth: number;
    capeExtension: number;
    capeWidth: number;
    alpha0: number;
    showWaveRays: boolean;
    showDepthContours: boolean;
    showArrows: boolean;
    rayDensity: number;
  }>(defaultValues);
  
  // 输入框的字符串值（允许为空）
  const [inputValues, setInputValues] = useState<Record<string, string>>({
    h: '20',
    T: '8',
    L: '',
    H: '2',
    slope: '0.01',
    bayDepth: '10',
    bayWidth: '100',
    capeExtension: '50',
    capeWidth: '200',
    alpha0: '0'
  });
  
  // 处理输入框值变化（只更新字符串，不转换为数字）
  const handleInputChange = (field: string, value: string) => {
    setInputValues(prev => ({ ...prev, [field]: value }));
  };
  
  // 处理失去焦点事件 - 验证并应用参数
  const handleInputBlur = (field: string, defaultValue: number | undefined) => {
    const strValue = inputValues[field];
    let numValue: number | undefined;
    
    if (strValue === '' || strValue === undefined) {
      // 如果为空，使用默认值
      numValue = defaultValue;
      setInputValues(prev => ({ ...prev, [field]: defaultValue !== undefined ? String(defaultValue) : '' }));
    } else {
      numValue = Number(strValue);
      if (isNaN(numValue)) {
        numValue = defaultValue;
        setInputValues(prev => ({ ...prev, [field]: defaultValue !== undefined ? String(defaultValue) : '' }));
      }
    }
    
    // 更新参数
    let updatedParams = { ...params, [field]: numValue };
    
    // 特殊处理 h, T, L 的自动计算
    if (field === 'h' || field === 'T' || field === 'L') {
      if (updatedParams.h && updatedParams.T && !updatedParams.L) {
        const k = solveWaveNumber(updatedParams.h, updatedParams.T);
        const L = (2 * Math.PI) / k;
        updatedParams.L = L;
        setInputValues(prev => ({ ...prev, L: L.toFixed(2) }));
      } else if (updatedParams.h && updatedParams.L && !updatedParams.T) {
        const result = solveFromWavelength(updatedParams.h, updatedParams.L);
        updatedParams.T = result.T;
        setInputValues(prev => ({ ...prev, T: result.T.toFixed(2) }));
      }
    }
    
    setParams(updatedParams);
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
    bayWidth: params.bayWidth,
    capeExtension: params.capeExtension,
    capeWidth: params.capeWidth,
    alpha0: params.alpha0
  });
  
  // 处理重置
  const handleReset = () => {
    setParams(defaultValues);
    setInputValues({
      h: '20',
      T: '8',
      L: '',
      H: '2',
      slope: '0.01',
      bayDepth: '10',
      bayWidth: '100',
      capeExtension: '50',
      capeWidth: '200',
      alpha0: '0'
    });
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
            rayDensity={params.rayDensity}
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
            {/* 提示已移除：编辑 h/T/L 的说明 */}
            
            <div className="param-group">
              <label>初始水深 h (m):</label>
              <input
                type="number"
                value={inputValues.h}
                onChange={(e) => handleInputChange('h', e.target.value)}
                onBlur={() => handleInputBlur('h', 20)}
                step="1"
                min="0.1"
              />
              <div className="range-hint">建议范围: 0.1 - 100 m （常用 5 - 30 m）</div>
            </div>
            
            <div className="param-group">
              <label>周期 T (s):</label>
              <input
                type="number"
                value={inputValues.T}
                onChange={(e) => handleInputChange('T', e.target.value)}
                onBlur={() => handleInputBlur('T', 8)}
                step="0.1"
                min="0.1"
              />
              <div className="range-hint">建议范围: 0.1 - 30 s （常用 5 - 15 s）</div>
            </div>
            
            <div className="param-group">
              <label>波长 L (m):</label>
              <input
                type="number"
                value={inputValues.L}
                onChange={(e) => handleInputChange('L', e.target.value)}
                onBlur={() => handleInputBlur('L', undefined)}
                step="1"
                min="0.1"
              />
              <div className="range-hint">建议范围: 0.1 - 500 m （可由 T/h 自动计算）</div>
            </div>
            
            <div className="param-group">
              <label>波高 H (m):</label>
              <input
                type="number"
                value={inputValues.H}
                onChange={(e) => handleInputChange('H', e.target.value)}
                onBlur={() => handleInputBlur('H', 2)}
                step="0.1"
                min="0.1"
              />
              <div className="range-hint">建议范围: 0.1 - 10 m</div>
            </div>
          </section>
          
          {/* 地形参数 */}
          <section className="param-section">
            <h3>🏖️ 地形参数</h3>
            
            <div className="param-group">
              <label>海底坡度 i:</label>
              <input
                type="number"
                value={inputValues.slope}
                onChange={(e) => handleInputChange('slope', e.target.value)}
                onBlur={() => handleInputBlur('slope', 0.01)}
                step="0.001"
                min="0.001"
                max="0.1"
              />
              <span className="unit">({(params.slope * 100).toFixed(1)}%)</span>
              <div className="range-hint">建议范围: 0.001 - 0.1 （常用 0.005 - 0.05）</div>
            </div>
            
            <div className="param-group">
              <label>海湾凹进深度 (m):</label>
              <input
                type="number"
                value={inputValues.bayDepth}
                onChange={(e) => handleInputChange('bayDepth', e.target.value)}
                onBlur={() => handleInputBlur('bayDepth', 10)}
                step="1"
                min="0"
                max="100"
              />
              <div className="range-hint">建议范围: 0 - 100 m （较小值为浅湾，较大值为深湾）</div>
            </div>
            
            <div className="param-group">
              <label>海湾宽度 (m):</label>
              <input
                type="number"
                value={inputValues.bayWidth}
                onChange={(e) => handleInputChange('bayWidth', e.target.value)}
                onBlur={() => handleInputBlur('bayWidth', 100)}
                step="10"
                min="20"
                max="400"
              />
              <div className="range-hint">建议范围: 20 - 400 m</div>
            </div>
            
            <div className="param-group">
              <label>海岬凸出距离 (m):</label>
              <input
                type="number"
                value={inputValues.capeExtension}
                onChange={(e) => handleInputChange('capeExtension', e.target.value)}
                onBlur={() => handleInputBlur('capeExtension', 50)}
                step="1"
                min="0"
                max="150"
              />
              <div className="range-hint">建议范围: 0 - 150 m</div>
            </div>
            
            <div className="param-group">
              <label>海岬宽度 (m):</label>
              <input
                type="number"
                value={inputValues.capeWidth}
                onChange={(e) => handleInputChange('capeWidth', e.target.value)}
                onBlur={() => handleInputBlur('capeWidth', 200)}
                step="10"
                min="20"
                max="400"
              />
              <div className="range-hint">建议范围: 20 - 400 m</div>
            </div>
            
            <div className="param-group">
              <label>初始波向角 α₀ (°):</label>
              <input
                type="number"
                value={inputValues.alpha0}
                onChange={(e) => handleInputChange('alpha0', e.target.value)}
                onBlur={() => handleInputBlur('alpha0', 0)}
                step="5"
                min="-45"
                max="45"
              />
              <div className="range-hint">建议范围: -45° - 45°（常用 ±15°）</div>
            </div>
          </section>
          
          {/* 显示选项 */}
          <section className="param-section">
            <h3>👁️ 显示选项</h3>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={params.showWaveRays}
                  onChange={(e) => {
                    setParams({...params, showWaveRays: e.target.checked});
                  }}
                />
                <span>显示波峰线和波向线</span>
              </label>
            </div>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={params.showDepthContours}
                  onChange={(e) => {
                    setParams({...params, showDepthContours: e.target.checked});
                  }}
                />
                <span>显示等深线</span>
              </label>
            </div>
            
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={params.showArrows}
                  onChange={(e) => {
                    setParams({...params, showArrows: e.target.checked});
                  }}
                />
                <span>显示波向箭头</span>
              </label>
            </div>
            
            <div className="param-group">
              <label>波向线密度:</label>
              <input
                type="range"
                min="8"
                max="64"
                step="4"
                value={params.rayDensity}
                onChange={(e) => {
                  setParams({...params, rayDensity: Number(e.target.value)});
                }}
              />
              <span className="unit">{params.rayDensity} 条</span>
              <div className="range-hint">建议范围: 8 - 64 条（越多越密集，性能略受影响）</div>
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
