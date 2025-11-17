// 文件名: src/WaveRefractionView.tsx
// 波浪折射可视化 - 俯视图
// 
// 坐标系统（从上往下看海面）：
// - X轴：东西方向，向右为东
// - Y轴：南北方向，向上为北（在SVG中需要翻转）
// - 波浪从南（下方）传来，向北（上方）传播
// - 海岸线在北侧（上方）
// - 波向角α：从北向（+Y方向）顺时针测量
//   * α=0: 正北
//   * α>0: 东北方向
//   * α<0: 西北方向

import { useMemo, useState, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import type { GridPoint, CoastlinePoint, DepthContour } from './waveRefraction';
import type { ModelConfig, DispersionResult } from './useWaveRefractionModel';

interface SelectedPoint {
  svgX: number;
  svgY: number;
  point: GridPoint;
}

interface CoastalFeature {
  type: 'bay' | 'cape';
  x: number;
  strength: number;
  bandwidth: number;
}

interface Props {
  grid: GridPoint[][];
  coastline: CoastlinePoint[];
  contours: DepthContour[];
  dispersion: DispersionResult;
  config: ModelConfig;
  showWaveRays?: boolean;
  showDepthContours?: boolean;
  showArrows?: boolean;
}

export function WaveRefractionView({
  grid,
  coastline,
  contours,
  dispersion,
  config,
  showWaveRays = true,
  showDepthContours = true,
  showArrows = true
}: Props) {
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  if (!grid || grid.length === 0) {
    return <div>加载中...</div>;
  }

  const gridY = grid.length;
  const gridX = grid[0].length;
  
  // SVG尺寸
  const svgWidth = 1000;
  const svgHeight = (config.domainHeight / config.domainWidth) * svgWidth;
  
  // 坐标转换：物理坐标 → SVG坐标
  // SVG坐标系：原点在左上角，Y轴向下
  // 物理坐标系：原点在左下角，Y轴向上（北）
  const scaleX = svgWidth / config.domainWidth;
  const scaleY = svgHeight / config.domainHeight;
  const toSvgX = (x: number) => x * scaleX;
  const toSvgY = (y: number) => svgHeight - y * scaleY; // Y轴翻转：物理上方→SVG上方

  // 生成海岸线路径（使用传入的coastline数据）
  const coastlinePath = coastline
    .map((p, idx) => {
      const x = toSvgX(p.x);
      const y = toSvgY(p.y);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const coastlineStep = coastline.length > 1 ? coastline[1].x - coastline[0].x : 1;

  const coastalFeatures = useMemo(() => {
    if (coastline.length < 5 || coastlineStep <= 0) {
      return [] as CoastalFeature[];
    }

    const curvatures = coastline.map((point, idx) => {
      if (idx === 0 || idx === coastline.length - 1) {
        return 0;
      }
      const prev = coastline[idx - 1];
      const next = coastline[idx + 1];
      return (next.y - 2 * point.y + prev.y) / (coastlineStep * coastlineStep);
    });

    const maxAbsCurvature = curvatures.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    if (maxAbsCurvature < 1e-6) {
      return [] as CoastalFeature[];
    }

    const threshold = maxAbsCurvature * 0.18;
    const features: CoastalFeature[] = [];

    let idx = 1;
    while (idx < coastline.length - 1) {
      const curvature = curvatures[idx];
      if (Math.abs(curvature) < threshold) {
        idx++;
        continue;
      }

      const sign = Math.sign(curvature);
      let segmentStart = idx;
      let segmentEnd = idx;
      let weightedSum = 0;
      let weightTotal = 0;
      let peakStrength = Math.abs(curvature);

      while (segmentEnd < coastline.length - 1 && Math.sign(curvatures[segmentEnd]) === sign && Math.abs(curvatures[segmentEnd]) >= threshold * 0.4) {
        const magnitude = Math.abs(curvatures[segmentEnd]);
        weightedSum += coastline[segmentEnd].x * magnitude;
        weightTotal += magnitude;
        peakStrength = Math.max(peakStrength, magnitude);
        segmentEnd++;
      }

      const defaultIdx = Math.round((segmentStart + segmentEnd) / 2);
      const centerX = weightTotal > 0
        ? weightedSum / weightTotal
        : coastline[Math.max(0, Math.min(coastline.length - 1, defaultIdx))].x;
      const span = Math.max(2, segmentEnd - segmentStart + 1);
      const minBandwidth = coastlineStep * 8;
      const bandwidth = Math.max(minBandwidth, Math.sqrt(span) * coastlineStep * 1.6);

      features.push({
        type: sign > 0 ? 'bay' : 'cape',
        x: centerX,
        strength: peakStrength / maxAbsCurvature,
        bandwidth
      });

      idx = segmentEnd + 1;
    }

    return features;
  }, [coastline, coastlineStep]);

  // 生成等深线路径（使用传入的contours数据）
  const contourPaths = showDepthContours ? contours.map((contour: DepthContour) => {
    const path = contour.points
      .map((p: { x: number; y: number }, idx: number) => {
        const x = toSvgX(p.x);
        const y = toSvgY(p.y);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
    return { depth: contour.depth, path, points: contour.points };
  }) : [];

  // 准备波浪波向线（波射线）与波峰线
  const waveRays: JSX.Element[] = [];
  const waveDirectionLines: JSX.Element[] = [];
  const rayArrows: JSX.Element[] = [];

  const rayPaths: Array<Array<{ x: number; y: number; distToCoast: number }>> = [];
  const dxPhys = config.domainWidth / (gridX - 1);
  const dyPhys = config.domainHeight / (gridY - 1);

  const getCoastlineY = (x: number) => {
    if (!coastline.length) return 0;
    if (x <= coastline[0].x) return coastline[0].y;
    const last = coastline[coastline.length - 1];
    if (x >= last.x) return last.y;

    for (let idx = 1; idx < coastline.length; idx++) {
      const prev = coastline[idx - 1];
      const next = coastline[idx];
      if (x <= next.x) {
        const t = (x - prev.x) / (next.x - prev.x);
        return prev.y + t * (next.y - prev.y);
      }
    }
    return coastline[coastline.length - 1].y;
  };

  const samplePoint = (x: number, y: number): GridPoint | undefined => {
    if (x < 0 || x > config.domainWidth || y < 0 || y > config.domainHeight) {
      return undefined;
    }
    const col = Math.min(gridX - 1, Math.max(0, Math.round(x / dxPhys)));
    const row = Math.min(gridY - 1, Math.max(0, Math.round(y / dyPhys)));
    return grid[row]?.[col];
  };

  const traceRayFromDeep = (startIndex: number) => {
    const path: Array<{ x: number; y: number }> = [];
    const topPoint = grid[gridY - 1][startIndex];
    if (!topPoint || topPoint.h <= 0.05) {
      return path;
    }

    let currentX = topPoint.x;
    let currentY = topPoint.y;
    const stepSize = dyPhys * 0.85;
    const maxSteps = gridY * 3;

    for (let step = 0; step < maxSteps; step++) {
      const sample = samplePoint(currentX, currentY);
      if (!sample || sample.h <= 0.1) {
        const clampX = Math.max(0, Math.min(config.domainWidth, currentX));
        const coastY = getCoastlineY(clampX);
        path.push({ x: clampX, y: coastY });
        break;
      }

      path.push({ x: currentX, y: currentY });

      const dxStep = Math.sin(sample.alpha) * stepSize;
      const dyStep = Math.cos(sample.alpha) * stepSize;

      const coastlineY = getCoastlineY(currentX);
      const distanceToCoast = Math.max(0, currentY - coastlineY);
      let adjustedDx = dxStep;

      // 只有在靠近海岸时才施加横向调整
      // 定义一个影响区域：只有当距离海岸小于某个阈值时才开始影响
      const influenceThreshold = config.domainHeight * 0.35; // 35%的区域高度作为影响阈值
      
      if (distanceToCoast > 0.01 && distanceToCoast < influenceThreshold && coastalFeatures.length) {
        // 使用更陡峭的衰减函数，使得只有非常靠近海岸时才有明显效果
        // 距离越近，权重越大
        const normalizedDist = distanceToCoast / influenceThreshold;
        const nearShoreWeight = Math.pow(1 - normalizedDist, 3); // 立方衰减，更陡峭
        
        let lateralAdjustment = 0;

        coastalFeatures.forEach(feature => {
          const dxToCenter = currentX - feature.x;
          const variance = Math.max(4, feature.bandwidth * feature.bandwidth);
          const featureInfluence = Math.exp(-(dxToCenter * dxToCenter) / (2 * variance));
          if (featureInfluence < 1e-5) {
            return;
          }
          const direction = feature.type === 'bay' ? 1 : -1;
          const normalizedOffset = dxToCenter / Math.max(feature.bandwidth, 10);
          lateralAdjustment += direction * normalizedOffset * feature.strength * featureInfluence;
        });

        if (Math.abs(lateralAdjustment) > 1e-6) {
          // 只使用近岸权重，并且调整强度
          const tuning = stepSize * 0.65;
          adjustedDx += lateralAdjustment * nearShoreWeight * tuning;
        }
      }

      const maxShift = stepSize * 0.75;
      adjustedDx = Math.max(-maxShift, Math.min(maxShift, adjustedDx));

      currentX += adjustedDx;
      currentY -= dyStep;

      if (currentX < 0 || currentX > config.domainWidth || currentY < 0) {
        const clampX = Math.max(0, Math.min(config.domainWidth, currentX));
        const coastY = getCoastlineY(clampX);
        path.push({ x: clampX, y: coastY });
        break;
      }
    }

    if (path.length < 2) {
      path.push({ x: currentX, y: getCoastlineY(currentX) });
    }

    return path;
  };

  const handleSvgClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const svgElement = event.currentTarget;
    const rect = svgElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const physX = (clickX / rect.width) * config.domainWidth;
    const physY = config.domainHeight - (clickY / rect.height) * config.domainHeight;

    const nearestPoint = samplePoint(physX, physY);
    if (!nearestPoint) {
      setSelectedPoint(null);
      return;
    }

    setSelectedPoint({
      svgX: toSvgX(nearestPoint.x),
      svgY: toSvgY(nearestPoint.y),
      point: nearestPoint
    });
  };

  const attachDistanceToCoast = (path: Array<{ x: number; y: number }>) => {
    const result: Array<{ x: number; y: number; distToCoast: number }> = new Array(path.length);
    let accum = 0;
    for (let i = path.length - 1; i >= 0; i--) {
      const point = path[i];
      if (i === path.length - 1) {
        accum = 0;
        result[i] = { ...point, distToCoast: 0 };
      } else {
        const next = path[i + 1];
        accum += Math.hypot(next.x - point.x, next.y - point.y);
        result[i] = { ...point, distToCoast: accum };
      }
    }
    return result;
  };

  if (showWaveRays) {
    const rayCount = 18;
    for (let r = 0; r < rayCount; r++) {
      const ratio = (r + 0.5) / rayCount;
      const startIndex = Math.min(gridX - 1, Math.max(0, Math.round(ratio * (gridX - 1))));
      const path = traceRayFromDeep(startIndex);
      if (path.length > 2) {
        rayPaths.push(attachDistanceToCoast(path));
      }
    }

    rayPaths.forEach((path, idx) => {
      if (path.length < 2) return;

      const d = path
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
        .join(' ');

      waveDirectionLines.push(
        <path
          key={`direction-${idx}`}
          d={d}
          stroke="#DAA520"
          strokeWidth="2"
          fill="none"
          opacity="0.8"
        />
      );

      if (showArrows) {
        const spacing = Math.max(2, Math.floor(path.length / 6));
        const coastPoint = path[path.length - 1];
        const coastSvgX = toSvgX(coastPoint.x);
        const coastSvgY = toSvgY(coastPoint.y);
        for (let k = spacing; k < path.length; k += spacing) {
          const prev = path[k - 1];
          const curr = path[k];
          const prevX = toSvgX(prev.x);
          const prevY = toSvgY(prev.y);
          const currX = toSvgX(curr.x);
          const currY = toSvgY(curr.y);
          const dx = currX - prevX;
          const dy = currY - prevY;
          const magnitude = Math.hypot(dx, dy) || 1;
          const ux = dx / magnitude;
          const uy = dy / magnitude;
          const distToCoastPx = Math.hypot(coastSvgX - currX, coastSvgY - currY);
          if (distToCoastPx <= 6) {
            continue;
          }
          const arrowLength = Math.min(22, Math.max(8, distToCoastPx - 4));

          rayArrows.push(
            <g key={`ray-arrow-${idx}-${k}`} transform={`translate(${currX}, ${currY})`}>
              <line
                x1={0}
                y1={0}
                x2={ux * arrowLength}
                y2={uy * arrowLength}
                stroke="#DAA520"
                strokeWidth="2"
                markerEnd="url(#rayArrowhead)"
              />
            </g>
          );
        }
      }
    });

    if (rayPaths.length > 1) {
      const desiredWavefronts = 6;
      const maxDistance = Math.max(...rayPaths.map(path => path[0].distToCoast));

      for (let w = 1; w <= desiredWavefronts; w++) {
        const targetDistance = (w / (desiredWavefronts + 1)) * maxDistance;
        const rawPoints: Array<{ x: number; y: number; coastY: number }> = [];

  rayPaths.forEach(path => {
          if (path[0].distToCoast < targetDistance) {
            return;
          }

          for (let i = 0; i < path.length - 1; i++) {
            const curr = path[i];
            const next = path[i + 1];
            if (curr.distToCoast >= targetDistance && next.distToCoast <= targetDistance) {
              const denom = curr.distToCoast - next.distToCoast;
              const ratio = denom > 1e-6 ? (curr.distToCoast - targetDistance) / denom : 0;
              const x = curr.x + (next.x - curr.x) * ratio;
              const y = curr.y + (next.y - curr.y) * ratio;
              const coastY = getCoastlineY(x);

              rawPoints.push({ x, y, coastY });
              break;
            }
          }
        });

        if (rawPoints.length > 2) {
          const avgY = rawPoints.reduce((sum, p) => sum + p.y, 0) / rawPoints.length;
          const avgCoastY = rawPoints.reduce((sum, p) => sum + p.coastY, 0) / rawPoints.length;
          const curvatureStrength = 0.22 * (1 - targetDistance / (maxDistance + 1e-6));

          const points = rawPoints.map(p => {
            const coastDeviation = p.coastY - avgCoastY;
            const adjustedY = avgY + coastDeviation * curvatureStrength;
            return { x: p.x, y: adjustedY };
          });

          const d = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
            .join(' ');

          waveRays.push(
            <path
              key={`wavefront-${w}`}
              d={d}
              stroke="#1E90FF"
              strokeWidth="2"
              fill="none"
              opacity="0.9"
            />
          );
        }
      }
    }
  }

  // 生成水深渐变色块
  const depthCells: JSX.Element[] = [];
  const cellSkip = 2; // 每隔2个格子绘制一个，避免太密集
  for (let j = 0; j < gridY; j += cellSkip) {
    for (let i = 0; i < gridX; i += cellSkip) {
      const point = grid[j][i];
      if (point.h > 0.1) { // 只绘制水域
        const x1 = toSvgX(point.x);
        const y1 = toSvgY(point.y);
        const x2 = toSvgX(point.x + config.domainWidth / (gridX - 1) * cellSkip);
        const y2 = toSvgY(point.y + config.domainHeight / (gridY - 1) * cellSkip);
        
        // 根据水深计算颜色
        const depthRatio = Math.min(point.h / 30, 1); // 30m为最深
        const blue = Math.floor(120 + depthRatio * 135); // 浅蓝到深蓝
        const color = `rgba(${100 - depthRatio * 100}, ${150 - depthRatio * 50}, ${blue}, 0.3)`;
        
        depthCells.push(
          <rect
            key={`cell-${i}-${j}`}
            x={Math.min(x1, x2)}
            y={Math.min(y1, y2)}
            width={Math.abs(x2 - x1)}
            height={Math.abs(y2 - y1)}
            fill={color}
          />
        );
      }
    }
  }

  let selectionOverlay: JSX.Element | null = null;
  if (selectedPoint) {
    const point = selectedPoint.point;
    const distanceToCoast = Math.max(0, point.y - getCoastlineY(point.x));
    const angleDeg = point.h > 0.1 ? (point.alpha * 180) / Math.PI : 0;
    const hasWaveData = point.h > 0.1 && point.k > 0;

    const infoLines = [
      `x: ${point.x.toFixed(1)} m`,
      `y: ${point.y.toFixed(1)} m`,
      `水深: ${point.h.toFixed(2)} m`,
      `距岸: ${distanceToCoast.toFixed(1)} m`,
      `波速: ${hasWaveData ? point.c.toFixed(2) : '--'} m/s`,
      `波数: ${hasWaveData ? point.k.toFixed(3) : '--'} rad/m`,
      `波向角: ${hasWaveData ? `${angleDeg.toFixed(1)}°` : '--'}`
    ];

    const tooltipPadding = 8;
    const lineHeight = 16;
    const tooltipWidth = 170;
    const tooltipHeight = tooltipPadding * 2 + infoLines.length * lineHeight;
    let tooltipX = selectedPoint.svgX + 14;
    if (tooltipX + tooltipWidth > svgWidth - 6) {
      tooltipX = selectedPoint.svgX - tooltipWidth - 14;
    }
    let tooltipY = selectedPoint.svgY - tooltipHeight - 14;
    if (tooltipY < 12) {
      tooltipY = selectedPoint.svgY + 14;
    }
    if (tooltipY + tooltipHeight > svgHeight - 12) {
      tooltipY = svgHeight - tooltipHeight - 12;
    }

    selectionOverlay = (
      <g pointerEvents="none">
        <circle
          cx={selectedPoint.svgX}
          cy={selectedPoint.svgY}
          r={6}
          fill="rgba(220, 20, 60, 0.2)"
          stroke="#DC143C"
          strokeWidth={2}
        />
        <circle
          cx={selectedPoint.svgX}
          cy={selectedPoint.svgY}
          r={2.5}
          fill="#DC143C"
        />
        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipWidth}
          height={tooltipHeight}
          rx={8}
          ry={8}
          fill="rgba(255,255,255,0.95)"
          stroke="#34495e"
          strokeWidth={1.5}
        />
        <text
          x={tooltipX + tooltipPadding}
          y={tooltipY + tooltipPadding + 12}
          fill="#2c3e50"
          fontSize={13}
          fontFamily="'Segoe UI', 'Helvetica Neue', Arial"
        >
          {infoLines.map((line, idx) => (
            <tspan key={line} x={tooltipX + tooltipPadding} dy={idx === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  return (
    <div className="wave-refraction-view">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ background: '#ffffff', border: '2px solid #34495e', cursor: 'crosshair' }}
        onClick={handleSvgClick}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="context-stroke" />
          </marker>
          <marker
            id="rayArrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#DAA520" />
          </marker>
        </defs>

        {/* 背景网格（可选） */}
        <rect width={svgWidth} height={svgHeight} fill="#fafafa" opacity="0.5" />

        {/* 等深线（橙色虚线） */}
        {contourPaths.map((contour, idx) => {
          // 在等深线的中间位置标注深度
          const midIdx = Math.floor(contour.points.length / 2);
          const midPoint = contour.points[midIdx];
          const labelX = toSvgX(midPoint.x);
          const labelY = toSvgY(midPoint.y);
          
          return (
            <g key={`contour-${idx}`}>
              <path
                d={contour.path}
                stroke="#FF8C00"
                strokeWidth="2"
                fill="none"
                opacity="0.7"
                strokeDasharray="8,4"
              />
              <text
                x={labelX}
                y={labelY - 5}
                fontSize="11"
                fill="#FF6600"
                fontWeight="bold"
                textAnchor="middle"
                style={{ 
                  textShadow: '0 0 3px white, 0 0 3px white'
                }}
              >
                {contour.depth}m
              </text>
            </g>
          );
        })}

        {/* 波向线（黄色竖线） */}
        {waveDirectionLines}
  {rayArrows}

        {/* 波峰线（蓝色实线） */}
        {waveRays}

  {selectionOverlay}

        {/* 海岸线（橙色粗线） */}
        <path
          d={coastlinePath}
          stroke="#FF8C00"
          strokeWidth="4"
          fill="none"
        />

        {/* 陆地填充（底部） - 橙色带斜纹 */}
        <defs>
          <pattern id="landPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#FF8C00" strokeWidth="3" />
          </pattern>
        </defs>
        <path
          d={`${coastlinePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`}
          fill="url(#landPattern)"
          opacity="0.5"
        />

        {/* 标注和说明 */}
        <g>
          {/* 左侧公式 */}
          <g transform="translate(20, 80)">
            <text fontSize="18" fontWeight="bold" fill="#2c3e50">
              k<tspan fontSize="14" dy="5">r</tspan><tspan dy="-5"> = </tspan>
            </text>
            <text x="50" y="0" fontSize="18" fontWeight="bold" fill="#2c3e50">
              √
            </text>
            <line x1="58" y1="2" x2="110" y2="2" stroke="#2c3e50" strokeWidth="2"/>
            <text x="65" y="-8" fontSize="16" fill="#2c3e50">
              b<tspan fontSize="12" dy="3">0</tspan>
            </text>
            <text x="65" y="20" fontSize="16" fill="#2c3e50">
              b<tspan fontSize="12" dy="3">t</tspan>
            </text>
          </g>
          
          {/* 海湾标注 */}
          <text 
            x={svgWidth * 0.3} 
            y={toSvgY(config.domainHeight * 0.20) + 40} 
            fontSize="18" 
            fontWeight="bold" 
            fill="#8B4513"
            textAnchor="middle"
          >
            海湾
          </text>
          
          {/* 海岬标注 */}
          <text 
            x={svgWidth * 0.7} 
            y={toSvgY(config.domainHeight * 0.20) + 40} 
            fontSize="18" 
            fontWeight="bold" 
            fill="#8B4513"
            textAnchor="middle"
          >
            海岬
          </text>
          
          {/* 海岸线标注 */}
          <text 
            x={svgWidth - 100} 
            y={toSvgY(config.domainHeight * 0.20) + 15} 
            fontSize="16" 
            fontWeight="bold" 
            fill="#2c3e50"
          >
            海岸线
          </text>
          
          {/* 波峰线标注 */}
          <text 
            x={30} 
            y={svgHeight * 0.25} 
            fontSize="16" 
            fontWeight="bold" 
            fill="#4169e1"
          >
            波峰线
          </text>
          
          {/* 波向线标注（带箭头） */}
          <g>
            <text 
              x={svgWidth / 2 - 80} 
              y={40} 
              fontSize="16" 
              fontWeight="bold" 
              fill="#B8860B"
            >
              波向线
            </text>
            {/* 向下的箭头 */}
            <defs>
              <marker
                id="arrowDown"
                markerWidth="12"
                markerHeight="12"
                refX="6"
                refY="10"
                orient="auto"
              >
                <path d="M2,2 L6,10 L10,2" fill="none" stroke="#4169e1" strokeWidth="2"/>
              </marker>
            </defs>
            <line
              x1={svgWidth / 2 - 20}
              y1={35}
              x2={svgWidth / 2 - 20}
              y2={80}
              stroke="#4169e1"
              strokeWidth="3"
              markerEnd="url(#arrowDown)"
            />
          </g>
          
          {/* 等深线标注 */}
          <text 
            x={svgWidth - 100} 
            y={svgHeight * 0.5} 
            fontSize="16" 
            fontWeight="bold" 
            fill="#FF8C00"
          >
            等深线
          </text>
        </g>
      </svg>

      {/* 参数信息 */}
      <div className="model-info">
        <h4>🌊 色散关系结果</h4>
        <p>波长 L = {dispersion.L.toFixed(2)} m</p>
        <p>周期 T = {dispersion.T.toFixed(2)} s</p>
        <p>波速 C = {dispersion.C.toFixed(2)} m/s</p>
        <p>波数 k = {dispersion.k.toFixed(4)} rad/m</p>
      </div>
    </div>
  );
}
