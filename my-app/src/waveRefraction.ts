// 文件名: src/waveRefraction.ts
// 波浪折射物理模型 - 基于有限差分法

/**
 * 色散关系求解器
 * 求解方程: σ² = g·k·tanh(k·h)
 * 其中 σ = 2π/T (角频率), k = 2π/L (波数)
 */

const GRAVITY = 9.81; // m/s²
const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-6;

// 网格常量（用于岸线和等深线生成）

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

export interface WaveParameters {
  h: number; // 水深 (m)
  T?: number; // 周期 (s)
  L?: number; // 波长 (m)
  H: number; // 波高 (m)
  slope: number; // 坡度 i
}

export interface DispersionResult {
  k: number; // 波数 (rad/m)
  L: number; // 波长 (m)
  T: number; // 周期 (s)
  C: number; // 波速 (m/s)
}

/**
 * 根据水深h和周期T，使用牛顿迭代法求解波数k
 * σ² = g·k·tanh(k·h)
 * 其中 σ = 2π/T
 */
export function solveWaveNumber(h: number, T: number): number {
  const sigma = (2 * Math.PI) / T; // 角频率
  const sigma2 = sigma * sigma;
  
  // 初始猜测：深水波近似 k₀ = σ²/g
  let k = sigma2 / GRAVITY;
  
  // 牛顿迭代法
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const kh = k * h;
    const tanh_kh = Math.tanh(kh);
    const sech2_kh = 1 / (Math.cosh(kh) * Math.cosh(kh));
    
    // f(k) = g·k·tanh(k·h) - σ²
    const f = GRAVITY * k * tanh_kh - sigma2;
    
    // f'(k) = g·tanh(k·h) + g·k·h·sech²(k·h)
    const df = GRAVITY * tanh_kh + GRAVITY * k * h * sech2_kh;
    
    // 牛顿迭代
    const k_new = k - f / df;
    
    if (Math.abs(k_new - k) < TOLERANCE) {
      return k_new;
    }
    
    k = k_new;
  }
  
  console.warn('波数求解未收敛，使用最后的迭代值');
  return k;
}

/**
 * 根据水深h和波长L，求解波数k和周期T
 */
export function solveFromWavelength(h: number, L: number): DispersionResult {
  const k = (2 * Math.PI) / L;
  const kh = k * h;
  
  // 从色散关系求 σ
  const sigma2 = GRAVITY * k * Math.tanh(kh);
  const sigma = Math.sqrt(sigma2);
  const T = (2 * Math.PI) / sigma;
  const C = L / T;
  
  return { k, L, T, C };
}

/**
 * 根据水深h和周期T，求解完整的色散关系
 */
export function solveDispersion(h: number, T: number): DispersionResult {
  const k = solveWaveNumber(h, T);
  const L = (2 * Math.PI) / k;
  const C = L / T;
  
  return { k, L, T, C };
}

/**
 * 2D地形生成器
 * 包含海湾(凹进10m)和岬角(凸出50m)
 */
export interface TerrainConfig {
  width: number; // 计算区域宽度 (m)
  height: number; // 计算区域高度 (m)
  gridX: number; // x方向网格数
  gridY: number; // y方向网格数
  slope: number; // 海底坡度 i
  bayDepth: number; // 海湾凹进深度 (m)
  capeExtension: number; // 岬角凸出距离 (m)
  coastlineBaselineRatio?: number; // 海岸线基准高度占比 (默认 0.18)
}

export interface GridPoint {
  x: number; // x坐标 (m)
  y: number; // y坐标 (m)
  h: number; // 水深 (m)
  k: number; // 波数 (rad/m)
  c: number; // 波速 (m/s)
  alpha: number; // 波向角 (rad)
}

/**
 * 生成包含海湾和岬角的海岸线（俯视图）
 * 
 * 坐标系统（从上往下看）：
 * - X轴：东西方向（水平，向右为东）
 * - Y轴：从下到上（0在底部，height在顶部）
 * - 海岸线在底部（Y轴下方，Y值较小）
 * - 波浪从上方传来，向下传播到海岸
 * 
 * @param x - x坐标 (0到width)
 * @param width - 区域宽度
 * @param bayDepth - 海湾凹进深度（向上/陆地方向，y增加）
 * @param capeExtension - 岬角凸出距离（向下/海洋方向，y减小）
 * @returns 该x位置的海岸线y坐标（归一化，0-1范围）
 */
export function coastlineFunction(x: number, config: TerrainConfig): number {
  const { width, height, bayDepth, capeExtension, coastlineBaselineRatio } = config;

  // 基准海岸线位置（越小表示越靠近底部/海岸）
  const baselineRatio = coastlineBaselineRatio ?? 0.15;
  const baselineY = baselineRatio * height;

  // 使用高斯函数塑造海湾（向陆地凹进，y减小）
  const bayCenter = 0.28 * width;
  const baySigma = 0.05 * width;
  const bayScale = 2.6;
  const bayEffect = bayScale * bayDepth * Math.exp(-0.5 * Math.pow((x - bayCenter) / baySigma, 2));

  // 使用高斯函数塑造岬角（向海洋凸出，y减小）
  const capeCenter = 0.68 * width;
  const capeSigma = 0.10 * width;
  const capeScale = 1.10;
  const capeEffect = capeScale * capeExtension * Math.exp(-0.5 * Math.pow((x - capeCenter) / capeSigma, 2));

  const rawY = baselineY - bayEffect + capeEffect;

  // 限制在有效范围内，避免超出计算域
  const minY = 0.02 * height;
  const maxY = 0.6 * height;
  return Math.max(minY, Math.min(rawY, maxY));
}

/**
 * 生成完整的岸线坐标点数组
 */
export function generateCoastline(config: TerrainConfig, samples = 300): CoastlinePoint[] {
  const points: CoastlinePoint[] = [];

  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * config.width;
    const y = coastlineFunction(x, config);
    points.push({ x, y });
  }

  return points;
}

/**
 * 生成等深线数据
 * 根据海岸线形状和坡度计算等深线位置
 */
export function generateDepthContours(
  config: TerrainConfig,
  coastline: CoastlinePoint[],
  targetDepths: number[] = [5, 10, 15, 20, 25, 30]
): DepthContour[] {
  const contours: DepthContour[] = [];

  targetDepths.forEach(depth => {
    const points: { x: number; y: number }[] = [];

    coastline.forEach(({ x, y }) => {
      const contourY = y + depth / config.slope;
      if (contourY <= config.height) {
        points.push({ x, y: contourY });
      }
    });

    if (points.length > 1) {
      contours.push({ depth, points });
    }
  });

  return contours;
}

/**
 * 2D地形生成器（俯视图）
 * 
 * 坐标系统：
 * - X轴：东西方向（0到width），向右为东
 * - Y轴：从下到上（0到height），0在底部
 * - 波浪从上方（Y大）传来，向下方（Y小）的海岸线传播
 * - 海岸线位于Y≈0.15*height（底部）
 * - 水深：从海岸线（下方）向上逐渐增加
 */

/**
 * 生成2D地形网格（俯视图）
 */
export function generateTerrain(config: TerrainConfig): GridPoint[][] {
  const { width, height, gridX, gridY, slope } = config;
  const dx = width / (gridX - 1);
  const dy = height / (gridY - 1);
  
  const grid: GridPoint[][] = [];
  
  for (let j = 0; j < gridY; j++) {
    const row: GridPoint[] = [];
    const y = j * dy; // y坐标 (m)，从底部(0)到顶部(height)
    
    for (let i = 0; i < gridX; i++) {
      const x = i * dx; // x坐标 (m)，从西(0)到东(width)
      
      // 计算该x位置的海岸线y坐标（单位：m）
      const coastlineY = coastlineFunction(x, config);
      
      // 计算水深：从海岸线向上，距离 × 坡度
      // 如果在海岸线以下（y < coastlineY），则为陆地，水深为0
      let h: number;
      if (y <= coastlineY) {
        h = 0; // 陆地（底部，海岸线以下）
      } else {
        // 水深 = (当前y - 海岸线y) × 坡度
        // y越大（越靠上），水深越大
        h = (y - coastlineY) * slope;
      }
      
      row.push({
        x,
        y,
        h,
        k: 0, // 稍后计算
        c: 0,
        alpha: 0 // 稍后计算
      });
    }
    
    grid.push(row);
  }
  
  return grid;
}

/**
 * 根据色散关系更新网格中每个点的波数k
 */
export function updateWaveNumbers(grid: GridPoint[][], T: number): void {
  const sigma = (2 * Math.PI) / T;
  for (let j = 0; j < grid.length; j++) {
    for (let i = 0; i < grid[j].length; i++) {
      const point = grid[j][i];
      
      if (point.h > 0.1) { // 水深足够
        point.k = solveWaveNumber(point.h, T);
        point.c = sigma / point.k;
      } else {
        point.k = 0; // 陆地或极浅水
        point.c = 0;
      }
    }
  }
}

/**
 * 根据色散结果和斯涅尔定律更新波向角
 * C·sinα = 常数，其中C为局部波速
 */
export function updateWaveDirections(grid: GridPoint[][], T: number, alpha0: number): void {
  if (!grid.length || !grid[0].length) {
    return;
  }

  const sigma = (2 * Math.PI) / T;
  const gridY = grid.length;
  const gridX = grid[0].length;

  // 每一列对应的斯涅尔常数
  const snellConstants = new Array<number>(gridX).fill(0);

  for (let i = 0; i < gridX; i++) {
    // 从深水区（顶部）向下寻找首个水深足够的点
    for (let j = gridY - 1; j >= 0; j--) {
      const point = grid[j][i];
      if (point.h > 0.1 && point.k > 0) {
        const c = sigma / point.k;
        snellConstants[i] = c * Math.sin(alpha0);
        point.alpha = alpha0;
        break;
      }
    }
  }

  // 向下遍历并根据斯涅尔定律更新波向角
  for (let j = gridY - 2; j >= 0; j--) {
    for (let i = 0; i < gridX; i++) {
      const point = grid[j][i];
      if (point.h <= 0.1 || point.k <= 0) {
        point.alpha = 0;
        continue;
      }

      const c = sigma / point.k;
      const snell = snellConstants[i];

      if (snell === 0) {
        point.alpha = 0;
        continue;
      }

      let ratio = snell / c;
      const sign = ratio >= 0 ? 1 : -1;
      ratio = Math.min(0.999, Math.max(-0.999, ratio));

      let alpha = Math.asin(ratio);
      if (Number.isNaN(alpha)) {
        alpha = sign * (Math.PI / 2 - 0.01);
      }

      // 确保波浪主要向下传播
      const cosAlpha = Math.cos(alpha);
      if (cosAlpha <= 0) {
        alpha = sign * (Math.PI / 2 - 0.01);
      }

      point.alpha = alpha;
    }
  }
}

/**
 * 使用有限差分法求解波向角分布（理论实现）
 * 求解偏微分方程：∂(k·cosα)/∂y = -∂(k·sinα)/∂x
 *
 * 这个函数展示了如何用有限差分法替换上面的简化方法
 * 目前未在实际代码中使用，仅作为理论参考
 */
export function updateWaveDirectionsFDM(grid: GridPoint[][], T: number, alpha0: number): void {
  if (!grid.length || !grid[0].length) {
    return;
  }

  const gridY = grid.length;
  const gridX = grid[0].length;
  const dx = grid[0][1].x - grid[0][0].x; // 网格间距x
  const dy = grid[1][0].y - grid[0][0].y; // 网格间距y

  // 初始化深水边界条件（顶部）
  for (let i = 0; i < gridX; i++) {
    grid[gridY - 1][i].alpha = alpha0;
  }

  // 使用有限差分法逐步求解
  // 从深水区向浅水区推进（从j=gridY-2到j=0）
  for (let j = gridY - 2; j >= 0; j--) {
    for (let i = 0; i < gridX; i++) {
      const point = grid[j][i];

      if (point.h <= 0.1 || point.k <= 0) {
        point.alpha = 0;
        continue;
      }

      // 使用中心差分格式近似偏导数
      // ∂(k·cosα)/∂y ≈ [k(j+1,i)·cosα(j+1,i) - k(j-1,i)·cosα(j-1,i)] / (2·dy)
      // -∂(k·sinα)/∂x ≈ -[k(j,i+1)·sinα(j,i+1) - k(j,i-1)·sinα(j,i-1)] / (2·dx)

      // 获取相邻点的值（需要边界处理）
      const k_cos_up = (j + 1 < gridY) ? grid[j + 1][i].k * Math.cos(grid[j + 1][i].alpha) : 0;
      const k_cos_down = (j - 1 >= 0) ? grid[j - 1][i].k * Math.cos(grid[j - 1][i].alpha) : 0;

      const k_sin_right = (i + 1 < gridX) ? grid[j][i + 1].k * Math.sin(grid[j][i + 1].alpha) : 0;
      const k_sin_left = (i - 1 >= 0) ? grid[j][i - 1].k * Math.sin(grid[j][i - 1].alpha) : 0;

      // 有限差分近似
      const d_kcos_dy = (k_cos_up - k_cos_down) / (2 * dy);
      const d_ksin_dx = (k_sin_right - k_sin_left) / (2 * dx);

      // 方程：∂(k·cosα)/∂y = -∂(k·sinα)/∂x
      // 即：d_kcos_dy + d_ksin_dx = 0

      // 这里需要迭代求解α，因为方程是非线性的
      // 简化的处理：使用上一点的值作为初始猜测
      let alpha = (j + 1 < gridY) ? grid[j + 1][i].alpha : alpha0;

      // 简单的迭代求解（实际实现需要更复杂的算法）
      for (let iter = 0; iter < 10; iter++) {
        // 计算残差（简化版本）
        const residual = d_kcos_dy + d_ksin_dx;

        // 简单的修正（实际需要计算雅可比矩阵）
        if (Math.abs(residual) > 1e-6) {
          alpha -= 0.1 * residual; // 简单的梯度下降
        }
      }

      // 确保角度在合理范围内
      alpha = Math.max(-Math.PI/2, Math.min(Math.PI/2, alpha));
      point.alpha = alpha;
    }
  }
}
