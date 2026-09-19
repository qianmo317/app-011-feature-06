import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import type { Pt, Room } from '../types';
import { polygonArea, polygonPerimeter, snapAngle, dist } from '../utils/geometry';
import RoomCanvas from '../components/RoomCanvas';
import OpeningEditor from '../components/OpeningEditor';

export default function PlanEditor() {
  const { id } = useParams<{ id: string }>();
  const { getPlan, addRoom, updateRoom, deleteRoom } = useStore();
  const plan = getPlan(id!);

  const [mode, setMode] = useState<'draw' | 'edit' | 'opening'>('edit');
  const [drawingPoints, setDrawingPoints] = useState<Pt[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomHeight, setRoomHeight] = useState('2800');
  const [floorMat, setFloorMat] = useState('floor');
  const [wallMat, setWallMat] = useState('paint');
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedRoom = plan?.rooms.find((r) => r.id === selectedRoomId);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mode !== 'draw' || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (drawingPoints.length > 2) {
        const first = drawingPoints[0];
        if (dist(pt, first) < 10) {
          finishDrawing();
          return;
        }
      }

      setDrawingPoints((prev) => {
        if (prev.length === 0) return [pt];
        const last = prev[prev.length - 1];
        const angle = snapAngle(pt.x - last.x, pt.y - last.y, 15);
        const d = dist(pt, last);
        const snapped = { x: last.x + Math.cos(angle) * d, y: last.y + Math.sin(angle) * d };
        return [...prev, snapped];
      });
    },
    [mode, drawingPoints]
  );

  const finishDrawing = () => {
    if (!plan || drawingPoints.length < 3) return;
    const room: Room = {
      id: Math.random().toString(36).slice(2),
      name: `房间${plan.rooms.length + 1}`,
      polygon: drawingPoints,
      heightMm: 2800,
      floorMat: 'floor',
      wallMat: 'paint',
    };
    addRoom(plan.id, room);
    setDrawingPoints([]);
    setMode('edit');
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setMode('edit');
  };

  const updateSelectedRoom = () => {
    if (!plan || !selectedRoomId) return;
    updateRoom(plan.id, selectedRoomId, (r) => ({
      ...r,
      name: roomName || r.name,
      heightMm: parseInt(roomHeight) || r.heightMm,
      floorMat,
      wallMat,
    }));
  };

  const totalArea = plan?.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0) || 0;
  const totalPerim = plan?.rooms.reduce((s, r) => s + polygonPerimeter(r.polygon), 0) || 0;

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  return (
    <div>
      <h2 className="page-title">{plan.name} - 平面绘制</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab active">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab">
          材料清单
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">
          导出打印
        </Link>
      </div>

      <div className="info-bar">
        <span>
          总面积: <strong>{totalArea.toFixed(2)} m²</strong>
        </span>
        <span>
          总周长: <strong>{totalPerim.toFixed(0)} mm</strong>
        </span>
        <span>
          房间数: <strong>{plan.rooms.length}</strong>
        </span>
      </div>

      <div className="toolbar">
        {mode === 'draw' ? (
          <>
            <span style={{ color: '#3498db' }}>点击绘制墙线，点击起点闭合</span>
            <button className="btn btn-primary" onClick={finishDrawing}>
              完成
            </button>
            <button className="btn btn-secondary" onClick={cancelDrawing}>
              取消
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => setMode('draw')}>
              绘制房间
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setMode('opening');
                setSelectedRoomId(null);
              }}
            >
              门窗开洞
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div className="canvas-container" style={{ flex: 1, minHeight: 500 }}>
          <svg
            ref={svgRef}
            width="100%"
            height="500"
            onClick={handleSvgClick}
            style={{ cursor: mode === 'draw' ? 'crosshair' : 'default' }}
          >
            <RoomCanvas
              rooms={plan.rooms}
              openings={plan.openings}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(id) => {
                setSelectedRoomId(id);
                const room = plan.rooms.find((r) => r.id === id);
                if (room) {
                  setRoomName(room.name);
                  setRoomHeight(String(room.heightMm));
                  setFloorMat(room.floorMat);
                  setWallMat(room.wallMat);
                }
              }}
              drawingPoints={drawingPoints}
            />
          </svg>
        </div>

        <div style={{ width: 280 }}>
          {mode === 'opening' ? (
            <OpeningEditor
              planId={plan.id}
              rooms={plan.rooms}
              openings={plan.openings}
            />
          ) : selectedRoom ? (
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>房间属性</h3>
              <div className="form-group">
                <label>名称</label>
                <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>层高 (mm)</label>
                <input value={roomHeight} onChange={(e) => setRoomHeight(e.target.value)} />
              </div>
              <div className="form-group">
                <label>地面材质</label>
                <select value={floorMat} onChange={(e) => setFloorMat(e.target.value)}>
                  <option value="floor">木地板</option>
                  <option value="tile_800">瓷砖800×800</option>
                  <option value="tile_300">瓷砖300×600</option>
                </select>
              </div>
              <div className="form-group">
                <label>墙面材质</label>
                <select value={wallMat} onChange={(e) => setWallMat(e.target.value)}>
                  <option value="paint">乳胶漆</option>
                  <option value="wallpaper">壁纸</option>
                  <option value="tile_300">瓷砖</option>
                </select>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={updateSelectedRoom}>
                  保存
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (selectedRoomId) {
                      deleteRoom(plan.id, selectedRoomId);
                      setSelectedRoomId(null);
                    }
                  }}
                >
                  删除
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
                <div>面积: {polygonArea(selectedRoom.polygon).toFixed(2)} m²</div>
                <div>周长: {polygonPerimeter(selectedRoom.polygon).toFixed(0)} mm</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ color: '#999', textAlign: 'center' }}>
              选择一个房间编辑属性
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
