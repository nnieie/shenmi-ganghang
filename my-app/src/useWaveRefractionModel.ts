// 文件名: src/useWaveRefractionModel.ts
import { useMemo } from 'react';
import {
  generateTerrain,
  generateCoastline,
  generateDepthContours,
  updateWaveNumbers,
  updateWaveDirections,
  solveDispersion,
  solveFromWavelength,
  type GridPoint,
  type CoastlinePoint,
  type DepthContour,
  type TerrainConfig,
  type WaveParameters,
  type DispersionResult
} from './waveRefraction';

export interface ModelConfig extends WaveParameters {
  // 区域大小
  domainWidth: number; // m
  domainHeight: number; // m
  gridX: number;
  gridY: number;
  
  // 地形参数
  bayDepth: number; // 海湾凹进深度 (m)
  bayWidth: number; // 海湾宽度 (m)
  capeExtension: number; // 岬角凸出距离 (m)
  capeWidth: number; // 海岬宽度 (m)
  
  // 初始波向角 (深水区)
  alpha0: number; // degrees
}

export interface ModelResult {
  grid: GridPoint[][];
  coastline: CoastlinePoint[];
  contours: DepthContour[];
  dispersion: DispersionResult;
  config: ModelConfig;
}

const DEFAULT_CONFIG: ModelConfig = {
  // 区域配置
  domainWidth: 1000, // 1km
  domainHeight: 800, // 800m
  gridX: 80,
  gridY: 60,
  
  // 波浪参数
  h: 20, // 初始水深 20m
  T: 8, // 周期 8s
  H: 2, // 波高 2m
  
  // 地形参数
  slope: 0.01, // 坡度 1%
  bayDepth: 10, // 海湾凹进 10m
  bayWidth: 100, // 海湾宽度 100m
  capeExtension: 50, // 岬角凸出 50m
  capeWidth: 200, // 海岬宽度 200m
  
  // 初始波向角
  alpha0: 0 // 垂直入射
};

export function useWaveRefractionModel(userConfig?: Partial<ModelConfig>): ModelResult {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  const result = useMemo(() => {
    console.log('🌊 开始计算波浪折射模型...');
    console.log('配置参数:', config);
    
    // 1. 求解色散关系
    let dispersion: DispersionResult;
    if (config.T) {
      dispersion = solveDispersion(config.h, config.T);
    } else if (config.L) {
      dispersion = solveFromWavelength(config.h, config.L);
    } else {
      throw new Error('必须提供周期T或波长L');
    }
    
    console.log('色散关系求解结果:', dispersion);
    
    // 2. 生成地形网格
    const terrainConfig: TerrainConfig = {
      width: config.domainWidth,
      height: config.domainHeight,
      gridX: config.gridX,
      gridY: config.gridY,
      slope: config.slope,
      bayDepth: config.bayDepth,
      bayWidth: config.bayWidth,
      capeExtension: config.capeExtension,
      capeWidth: config.capeWidth
    };
    
  const coastline = generateCoastline(terrainConfig);
  const contours = generateDepthContours(terrainConfig, coastline);
  const grid = generateTerrain(terrainConfig);
  console.log('地形网格与岸线生成完成');
    console.log('岸线和等深线生成完成');
    
    // 3. 更新每个网格点的波数k
  updateWaveNumbers(grid, dispersion.T);
  console.log('波数场计算完成');
    
  // 4. 更新波向角α
  const alpha0_rad = (config.alpha0 * Math.PI) / 180;
  updateWaveDirections(grid, alpha0_rad);
    console.log('波向角场计算完成');
    
    console.log('✅ 波浪折射模型计算完成！');
    
    return { grid, coastline, contours, dispersion, config };
  }, [
    config.domainWidth,
    config.domainHeight,
    config.gridX,
    config.gridY,
    config.h,
    config.T,
    config.L,
    config.H,
    config.slope,
    config.bayDepth,
    config.bayWidth,
    config.capeExtension,
    config.capeWidth,
    config.alpha0
  ]);
  
  return result;
}

// 导出默认配置供UI使用
export { DEFAULT_CONFIG };
export type { DispersionResult };
