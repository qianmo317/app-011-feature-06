import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import type { Outlet } from '../types';
import { getWallSegments, formatMm } from '../utils/geometry';

export default function WallEditor() {
  const { id } = useParams<{ id: string }>();
  const { getPlan, addOutlet, deleteOutlet } = useStore();
  const plan = getPlan(id!);

  const [roomId, setRoomId] = useState('');
  const [wallIndex, setWallIndex] = useState('0');
  const [xMm, setXMm] = useState('0');
  const [heightMm, setHeightMm] = useState('300');
  const [kind, setKind] = useState<Outlet['kind']>('socket');
  const [circuit, setCircuit] = useState('');

  const selectedRoom = plan?.rooms.find((r) => r.id === roomId);
  const wallSegs = selectedRoom ? getWallSegments(selectedRoom) : [];
  const wallKey = selectedRoom ? `${selectedRoom.id}-${wallIndex}` : '';

  const handleAdd = () => {
    if (!plan || !wallKey) return;
    const outlet: Outlet = {
      id: Math.random().toString(36).slice(2),
      wallKey,
      xMm: parseInt(xMm) || 0,
      heightMm: parseInt(heightMm) || 0,
      kind,
      circuit: circuit || undefined,
    };
    addOutlet(plan.id, outlet);
  };

  const wallOutlets = plan?.outlets.filter((o) => o.wallKey === wallKey) || [];
  const allOutlets = plan?.outlets || [];

  const outletCounts = {
    socket: allOutlets.filter((o) => o.kind === 'socket').length,
    switch: allOutlets.filter((o) => o.kind === 'switch').length,
    net: allOutlets.filter((o) => o.kind === 'net').length,
    light: allOutlets.filter((o) => o.kind === 'light').length,
    water: allOutlets.filter((o) => o.kind === 'water').length,
  };

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  return (
    <div>
      <h2 className="page-title">{plan.name} - 墙面展开与点位标注</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab active">
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
        <span>插座: <strong>{outletCounts.socket}</strong></span>
        <span>开关: <strong>{outletCounts.switch}</strong></span>
        <span>网口: <strong>{outletCounts.net}</strong></span>
        <span>灯位: <strong>{outletCounts.light}</strong></span>
        <span>水口: <strong>{outletCounts.water}</strong></span>
        <span>合计: <strong>{allOutlets.length}</strong></span>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 320 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>添加点位</h3>
            <div className="form-group">
              <label>房间</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">选择房间</option>
                {plan.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedRoom && (
              <>
                <div className="form-group">
                  <label>墙面</label>
                  <select value={wallIndex} onChange={(e) => setWallIndex(e.target.value)}>
                    {wallSegs.map((s, i) => (
                      <option key={i} value={i}>
                        墙{i + 1} ({formatMm(s.lengthMm)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>类型</label>
                  <select value={kind} onChange={(e) => setKind(e.target.value as Outlet['kind'])}>
                    <option value="socket">插座</option>
                    <option value="switch">开关</option>
                    <option value="net">网口</option>
                    <option value="light">灯位</option>
                    <option value="water">水口</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>距墙左端 (mm)</label>
                  <input value={xMm} onChange={(e) => setXMm(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>距地高度 (mm)</label>
                  <input value={heightMm} onChange={(e) => setHeightMm(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>回路 (可选)</label>
                  <input value={circuit} onChange={(e) => setCircuit(e.target.value)} placeholder="如: L1" />
                </div>

                <button className="btn btn-primary" onClick={handleAdd} style={{ width: '100%' }}>
                  添加点位
                </button>
              </>
            )}
          </div>

          {wallOutlets.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, marginBottom: 8 }}>当前墙面点位</h4>
              {wallOutlets.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid #ecf0f1',
                    fontSize: 13,
                  }}
                >
                  <span>
                    {o.kind === 'socket' ? '插座' : o.kind === 'switch' ? '开关' : o.kind === 'net' ? '网口' : o.kind === 'light' ? '灯位' : '水口'}
                    {' '}@{formatMm(o.xMm)} 高{formatMm(o.heightMm)}
                    {o.circuit ? ` (${o.circuit})` : ''}
                  </span>
                  <button className="btn btn-danger" onClick={() => deleteOutlet(plan.id, o.id)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 16 }}>墙面展开图</h3>
            <WallDiagram plan={plan} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WallDiagram({ plan }: { plan: { rooms: Array<{ id: string; name: string; polygon: { x: number; y: number }[]; heightMm: number; floorMat: string; wallMat: string }>; outlets: Outlet[] } }) {
  const wallHeight = 120;
  const wallGap = 20;
  let y = 20;

  return (
    <svg width="100%" height={plan.rooms.length * (wallHeight + wallGap) + 40}>
      {plan.rooms.map((room) => {
        const segs = getWallSegments(room);
        const maxLen = Math.max(...segs.map((s) => s.lengthMm), 1);
        const scale = 600 / maxLen;
        let x = 20;
        const roomY = y;
        y += wallHeight + wallGap;

        return (
          <g key={room.id}>
            <text x={20} y={roomY - 4} fontSize="12" fill="#2c3e50" fontWeight="500">
              {room.name}
            </text>
            {segs.map((seg, i) => {
              const w = seg.lengthMm * scale;
              const wallKey = `${room.id}-${i}`;
              const outlets = plan.outlets.filter((o) => o.wallKey === wallKey);

              return (
                <g key={i}>
                  <rect x={x} y={roomY} width={w} height={wallHeight} fill="#f8f9fa" stroke="#7f8c8d" strokeWidth={1} />
                  <text x={x + w / 2} y={roomY + wallHeight / 2 + 4} fontSize="10" fill="#999" textAnchor="middle">
                    墙{i + 1}
                  </text>
                  {outlets.map((o) => {
                    const ox = x + o.xMm * scale;
                    const oy = roomY + wallHeight - (o.heightMm / room.heightMm) * wallHeight;
                    const color =
                      o.kind === 'socket'
                        ? '#e74c3c'
                        : o.kind === 'switch'
                        ? '#3498db'
                        : o.kind === 'net'
                        ? '#9b59b6'
                        : o.kind === 'light'
                        ? '#f39c12'
                        : '#1abc9c';
                    return (
                      <g key={o.id}>
                        <circle cx={ox} cy={oy} r={5} fill={color} stroke="white" strokeWidth={1} />
                        <text x={ox} y={oy - 8} fontSize="8" fill={color} textAnchor="middle">
                          {o.kind === 'socket' ? '插' : o.kind === 'switch' ? '开' : o.kind === 'net' ? '网' : o.kind === 'light' ? '灯' : '水'}
                        </text>
                      </g>
                    );
                  })}
                  <text x={x + w / 2} y={roomY + wallHeight + 12} fontSize="9" fill="#666" textAnchor="middle">
                    {formatMm(seg.lengthMm)}
                  </text>
                  {x += w + 4}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
