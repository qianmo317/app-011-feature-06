import type { Pt, Room, Opening } from '../types';
import { polygonArea, dist, getWallSegments } from '../utils/geometry';

interface Props {
  rooms: Room[];
  openings: Opening[];
  selectedRoomId: string | null;
  onSelectRoom: (id: string) => void;
  drawingPoints: Pt[];
}

export default function RoomCanvas({
  rooms,
  openings,
  selectedRoomId,
  onSelectRoom,
  drawingPoints,
}: Props) {
  const allPoints = rooms.flatMap((r) => r.polygon);
  let minX = 0,
    minY = 0,
    maxX = 800,
    maxY = 500;
  if (allPoints.length > 0) {
    minX = Math.min(...allPoints.map((p) => p.x)) - 50;
    minY = Math.min(...allPoints.map((p) => p.y)) - 50;
    maxX = Math.max(...allPoints.map((p) => p.x)) + 50;
    maxY = Math.max(...allPoints.map((p) => p.y)) + 50;
  }
  if (drawingPoints.length > 0) {
    minX = Math.min(minX, ...drawingPoints.map((p) => p.x - 50));
    minY = Math.min(minY, ...drawingPoints.map((p) => p.y - 50));
    maxX = Math.max(maxX, ...drawingPoints.map((p) => p.x + 50));
    maxY = Math.max(maxY, ...drawingPoints.map((p) => p.y + 50));
  }

  const padding = 40;

  return (
    <g>
      {/* Grid */}
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect x={minX - padding} y={minY - padding} width={maxX - minX + padding * 2} height={maxY - minY + padding * 2} fill="url(#grid)" />

      {/* Rooms */}
      {rooms.map((room) => {
        const points = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
        const isSelected = room.id === selectedRoomId;
        const centerX = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
        const centerY = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;
        const area = polygonArea(room.polygon);

        return (
          <g key={room.id} onClick={() => onSelectRoom(room.id)} style={{ cursor: 'pointer' }}>
            <polygon
              points={points}
              fill={isSelected ? '#d6eaf8' : '#f8f9fa'}
              stroke={isSelected ? '#3498db' : '#7f8c8d'}
              strokeWidth={isSelected ? 2 : 1}
            />
            {/* Dimensions */}
            {room.polygon.map((p1, i) => {
              const p2 = room.polygon[(i + 1) % room.polygon.length];
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              const len = dist(p1, p2);
              return (
                <g key={i}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3498db" strokeWidth={1} strokeDasharray="4,2" />
                  <text x={mx} y={my - 4} fontSize="10" fill="#3498db" textAnchor="middle">
                    {len.toFixed(0)}mm
                  </text>
                </g>
              );
            })}
            <text x={centerX} y={centerY - 6} fontSize="12" fill="#2c3e50" textAnchor="middle" fontWeight="500">
              {room.name}
            </text>
            <text x={centerX} y={centerY + 10} fontSize="10" fill="#7f8c8d" textAnchor="middle">
              {area.toFixed(2)}m²
            </text>
          </g>
        );
      })}

      {/* Openings */}
      {openings.map((op) => {
        const room = rooms.find((r) => r.id === op.roomId);
        if (!room) return null;
        const seg = getWallSegments(room)[op.wallIndex];
        if (!seg) return null;
        const dx = seg.p2.x - seg.p1.x;
        const dy = seg.p2.y - seg.p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        const startX = seg.p1.x + (dx / len) * op.offsetMm;
        const startY = seg.p1.y + (dy / len) * op.offsetMm;
        const endX = startX + (dx / len) * op.widthMm;
        const endY = startY + (dy / len) * op.widthMm;
        const depth = 15;

        return (
          <g key={op.id}>
            <line
              x1={startX + nx * depth}
              y1={startY + ny * depth}
              x2={endX + nx * depth}
              y2={endY + ny * depth}
              stroke="#e74c3c"
              strokeWidth={2}
            />
            <text
              x={(startX + endX) / 2 + nx * (depth + 10)}
              y={(startY + endY) / 2 + ny * (depth + 10)}
              fontSize="9"
              fill="#e74c3c"
              textAnchor="middle"
            >
              {op.type === 'door' ? '门' : op.type === 'window' ? '窗' : op.type === 'sliding' ? '推拉门' : '垭口'}
            </text>
          </g>
        );
      })}

      {/* Drawing in progress */}
      {drawingPoints.length > 0 && (
        <g>
          <polyline
            points={drawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#3498db"
            strokeWidth={2}
            strokeDasharray="5,3"
          />
          {drawingPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#3498db" />
          ))}
        </g>
      )}
    </g>
  );
}
