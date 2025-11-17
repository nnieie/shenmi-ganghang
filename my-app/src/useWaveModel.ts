// 文件名: src/useWaveModel.ts
import { useMemo } from 'react';

// --- ⚙️ 配置参数 (Configuration) ---
const GRID_WIDTH = 50; // 多少列 (Column count)
const GRID_HEIGHT = 40; // 多少行 (Row count)
const INITIAL_ANGLE_DEG = 25; // 初始波浪角度 (偏离垂直方向)
const MAX_DEPTH = 50.0; // 最深处 (m) (图的顶部)
const MIN_DEPTH = 2.0;  // 最浅处 (m) (图的底部，接近岸线)
const GRAVITY = 9.81; // m/s^2 (重力加速度)
// ------------------------------------

// 定义一个格子的数据结构
export interface WaveCell {
  angle: number; // 角度 (in radians)
  depth: number; // 水深 (m)
  x: number; // 格子在网格中的 x 坐标
  y: number; // 格子在网格中的 y 坐标
}

// 岸线数据（根据图片的绿色曲线）
export interface CoastlinePoint {
  x: number;
  y: number;
}

// 等深线数据
export interface DepthContour {
  depth: number;
  points: { x: number; y: number }[];
}

/**
 * 根据位置计算水深（考虑岸线形状）
 */
function calculateDepth(x: number, y: number, coastline: CoastlinePoint[]): number {
  // 找到 x 位置对应的岸线 y 坐标
  const coastY = interpolateCoastline(x, coastline);
  
  // 如果在岸线之上（靠近岸边），返回浅水
  if (y >= coastY) {
    return MIN_DEPTH;
  }
  
  // 计算距离岸线的相对位置
  const distanceRatio = y / coastY;
  
  // 非线性深度变化（越靠近岸线越浅）
  const depth = MIN_DEPTH + (MAX_DEPTH - MIN_DEPTH) * Math.pow(distanceRatio, 1.5);
  
  return Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, depth));
}

/**
 * 插值获取岸线在指定 x 位置的 y 坐标
 */
function interpolateCoastline(x: number, coastline: CoastlinePoint[]): number {
  if (x <= 0) return coastline[0].y;
  if (x >= GRID_WIDTH) return coastline[coastline.length - 1].y;
  
  // 线性插值
  const index = (x / GRID_WIDTH) * (coastline.length - 1);
  const i1 = Math.floor(index);
  const i2 = Math.ceil(index);
  const t = index - i1;
  
  return coastline[i1].y * (1 - t) + coastline[i2].y * t;
}

/**
 * 这是一个自定义 Hook, 专门用来计算波浪折射模型
 * 它只会在组件加载时计算一次
 */
export function useWaveModel(): { 
  grid: WaveCell[][], 
  coastline: CoastlinePoint[], 
  contours: DepthContour[] 
} {
  
  const result = useMemo(() => {
    console.log("🌊 正在计算波浪折射模型...");
    
    // 生成岸线和等深线
    const coastline = generateCoastline();
    const contours = generateDepthContours();
    
    const grid: WaveCell[][] = [];
    
    // 1. 初始角度 (弧度) 和初始波速 (最深处)
    const initialAngleRad = INITIAL_ANGLE_DEG * (Math.PI / 180);
    const c0 = Math.sqrt(GRAVITY * MAX_DEPTH); // 初始波速 c = sqrt(g*d)
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const row: WaveCell[] = [];
      
      for (let x = 0; x < GRID_WIDTH; x++) {
        // 2. 计算当前格子的水深（考虑岸线形状）
        const currentDepth = calculateDepth(x, y, coastline);
        
        // 3. 计算当前位置的波速
        const c_y = Math.sqrt(GRAVITY * currentDepth);
        
        // 4. 应用斯涅尔定律 (Snell's Law)
        // sin(theta_y) / c_y = sin(theta_0) / c_0
        let sin_theta_y = Math.sin(initialAngleRad) * (c_y / c0);
        
        // 5. 钳制 (Clamp): sin值不能超过 1 或 -1
        sin_theta_y = Math.max(-1, Math.min(1, sin_theta_y));
        
        // 6. 计算最终角度 (in radians)
        const currentAngleRad = Math.asin(sin_theta_y);
        
        // 7. 添加轻微的随机扰动（模拟真实海况）
        const perturbation = (Math.random() - 0.5) * 0.05;
        
        row.push({ 
          angle: currentAngleRad + perturbation,
          depth: currentDepth,
          x,
          y
        });
      }
      grid.push(row);
    }
    
    console.log("✅ 波浪模型计算完成！");
    return { grid, coastline, contours };
  }, []); // 空依赖数组 [], 保证只计算一次

  return result;
}

/**
 * 生成岸线数据（模拟图片中的绿色曲线 - 凹入的弧形）
 */
export function generateCoastline(): CoastlinePoint[] {
  const points: CoastlinePoint[] = [];
  const numPoints = 100;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints; // 0 到 1
    const x = t * GRID_WIDTH;
    
    // 创建一个凹入的抛物线形状（中间凹陷）
    const centerX = GRID_WIDTH / 2;
    const distFromCenter = (x - centerX) / centerX; // -1 到 1
    const curvature = 0.15; // 凹陷程度
    const y = GRID_HEIGHT * (0.85 + curvature * (1 - distFromCenter * distFromCenter));
    
    points.push({ x, y });
  }
  
  return points;
}

/**
 * 生成等深线数据（模拟图片中的红色曲线）
 */
export function generateDepthContours(): DepthContour[] {
  const contours: DepthContour[] = [];
  const depths = [40, 30, 20, 10, 5]; // 不同的水深等值线
  
  depths.forEach(depth => {
    const points: { x: number; y: number }[] = [];
    const numPoints = 100;
    
    // 计算该深度对应的基础 y 位置
    const depthRatio = (MAX_DEPTH - depth) / (MAX_DEPTH - MIN_DEPTH);
    const baseY = depthRatio * GRID_HEIGHT * 0.85;
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = t * GRID_WIDTH;
      
      // 添加波浪起伏效果
      const wave = Math.sin(t * Math.PI * 2) * 2;
      const y = baseY + wave;
      
      points.push({ x, y });
    }
    
    contours.push({ depth, points });
  });
  
  return contours;
}