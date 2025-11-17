// 文件名: src/WaveGrid.tsx
import type { WaveCell, CoastlinePoint, DepthContour } from './useWaveModel'; // 导入类型

interface WaveGridProps {
  directions: WaveCell[][];
  coastline: CoastlinePoint[];
  contours: DepthContour[];
  showA: boolean; // 控制显示 A 组还是 B 组
}

const CELL_SIZE = 15; // 每个格子 15px
const ARROW_LENGTH = CELL_SIZE * 0.6; // 箭头长度

export function WaveGrid({ directions, coastline, contours, showA }: WaveGridProps) {
  if (!directions || directions.length === 0) {
    return <div>Loading grid...</div>;
  }

  const gridHeight = directions.length;
  const gridWidth = directions[0].length;

  const totalWidth = gridWidth * CELL_SIZE;
  const totalHeight = gridHeight * CELL_SIZE;

  // 将网格坐标转换为 SVG 坐标
  const toSvgX = (gridX: number) => gridX * CELL_SIZE;
  const toSvgY = (gridY: number) => gridY * CELL_SIZE;

  // 生成岸线路径
  const coastlinePath = coastline
    .map((point: CoastlinePoint, index: number) => {
      const x = toSvgX(point.x);
      const y = toSvgY(point.y);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg 
      width={totalWidth} 
      height={totalHeight} 
      className="wave-grid-svg"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#e8f4f8' }}
    >
      {/* 定义箭头标记 */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
        </marker>
      </defs>

      {/* 绘制网格背景 */}
      <rect width={totalWidth} height={totalHeight} fill="#d0e8f0" opacity="0.3" />

      {/* 绘制等深线（红色曲线） */}
      {contours.map((contour: DepthContour, idx: number) => {
        const path = contour.points
          .map((point: { x: number; y: number }, index: number) => {
            const x = toSvgX(point.x);
            const y = toSvgY(point.y);
            return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
          })
          .join(' ');
        
        return (
          <g key={`contour-${idx}`}>
            <path
              d={path}
              stroke="#e74c3c"
              strokeWidth="2"
              fill="none"
              opacity="0.6"
            />
            {/* 标注水深 */}
            <text
              x={toSvgX(5)}
              y={toSvgY(contour.points[5].y) - 5}
              fontSize="10"
              fill="#c0392b"
              fontWeight="bold"
            >
              {contour.depth}m
            </text>
          </g>
        );
      })}

      {/* 绘制波浪箭头 */}
      {directions.map((row, y) => {
        // --- AB 行交替闪烁的核心逻辑 ---
        const isARow = y % 2 === 0; // A 组 (第 0, 2, 4... 行)
        if (isARow && !showA) return null; // A 行, 但当前不显示 A
        if (!isARow && showA) return null; // B 行, 但当前显示 A (即不显示 B)
        // -------------------------------------

        return (
          <g key={`row-${y}`} className={isARow ? 'row-a' : 'row-b'}>
            {row.map((cell, x) => {
              // 每隔一列绘制箭头，避免太密集
              if (x % 2 !== 0) return null;

              // 1. 计算箭头中心点
              const cx = toSvgX(x) + CELL_SIZE / 2;
              const cy = toSvgY(y) + CELL_SIZE / 2;

              // 2. 转换角度为度 (for SVG rotate)
              const angleDeg = cell.angle * (180 / Math.PI);

              // 3. 根据水深改变箭头颜色（深水蓝，浅水青）
              const depthRatio = (cell.depth - 2) / (50 - 2);
              const color = `hsl(200, 70%, ${80 - depthRatio * 40}%)`;

              // 4. 箭头长度
              const len = ARROW_LENGTH / 2;
              const headSize = 4;
              
              return (
                <g 
                  key={`cell-${x}-${y}`} 
                  transform={`translate(${cx}, ${cy}) rotate(${angleDeg + 90})`}
                  className="wave-arrow"
                  style={{ color }}
                >
                  {/* 箭头杆 */}
                  <line 
                    x1={-len} 
                    y1="0" 
                    x2={len} 
                    y2="0"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  {/* 箭头头部 */}
                  <polygon 
                    points={`${len},0 ${len - headSize},${-headSize / 2} ${len - headSize},${headSize / 2}`}
                    fill="currentColor"
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 绘制岸线（绿色曲线） - 最后绘制确保在最上层 */}
      <path
        d={coastlinePath}
        stroke="#27ae60"
        strokeWidth="3"
        fill="none"
      />
      
      {/* 岸线下方填充陆地颜色 */}
      <path
        d={`${coastlinePath} L ${totalWidth} ${totalHeight} L 0 ${totalHeight} Z`}
        fill="#f0e68c"
        opacity="0.5"
      />

      {/* 标注岸线 */}
      <text
        x={toSvgX(gridWidth / 2) - 30}
        y={toSvgY(coastline[Math.floor(coastline.length / 2)].y) - 10}
        fontSize="12"
        fill="#27ae60"
        fontWeight="bold"
      >
        岸线
      </text>
    </svg>
  );
}