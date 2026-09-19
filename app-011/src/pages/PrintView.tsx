import { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { polygonArea, getWallSegments, formatMm } from '../utils/geometry';
import { calcMaterials } from '../utils/materialCalc';

export default function PrintView() {
  const { id } = useParams<{ id: string }>();
  const { getPlan } = useStore();
  const plan = getPlan(id!);
  const printRef = useRef<HTMLDivElement>(null);

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  const results = calcMaterials(plan.rooms, plan.openings, plan.materials);
  const totalPrice = results.reduce((s, r) => s + r.totalPrice, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <h2 className="page-title">{plan.name} - 导出打印</h2>

      <div className="tabs no-print">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab">
          材料清单
        </Link>
        <Link to={`/plan/${id}/print`} className="tab active">
          导出打印
        </Link>
      </div>

      <div className="toolbar no-print">
        <button className="btn btn-primary" onClick={handlePrint}>
          打印 / 存PDF
        </button>
      </div>

      <div ref={printRef} className="print-content">
        {/* Cover */}
        <div className="card print-page">
          <h1 style={{ textAlign: 'center', marginBottom: 24 }}>{plan.name}</h1>
          <h2 style={{ textAlign: 'center', color: '#666', fontWeight: 'normal' }}>家装施工图纸与材料清单</h2>
          <div style={{ marginTop: 40, textAlign: 'center', color: '#999' }}>
            生成时间: {new Date().toLocaleString()}
          </div>
        </div>

        {/* Floor Plan */}
        <div className="card print-page">
          <h2 style={{ marginBottom: 16, borderBottom: '2px solid #3498db', paddingBottom: 8 }}>
            平面图
          </h2>
          <svg width="100%" height="500" viewBox="0 0 800 500">
            {plan.rooms.map((room) => {
              const points = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
              const centerX = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
              const centerY = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;
              const area = polygonArea(room.polygon);

              return (
                <g key={room.id}>
                  <polygon points={points} fill="#f8f9fa" stroke="#2c3e50" strokeWidth={2} />
                  {room.polygon.map((p1, i) => {
                    const p2 = room.polygon[(i + 1) % room.polygon.length];
                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;
                    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                    return (
                      <g key={i}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#3498db" strokeWidth={1} strokeDasharray="4,2" />
                        <text x={mx} y={my - 4} fontSize="10" fill="#3498db" textAnchor="middle">{len.toFixed(0)}mm</text>
                      </g>
                    );
                  })}
                  <text x={centerX} y={centerY - 6} fontSize="14" fill="#2c3e50" textAnchor="middle" fontWeight="bold">{room.name}</text>
                  <text x={centerX} y={centerY + 12} fontSize="11" fill="#666" textAnchor="middle">{area.toFixed(2)}m²</text>
                </g>
              );
            })}
            {plan.openings.map((op) => {
              const room = plan.rooms.find((r) => r.id === op.roomId);
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
                  <line x1={startX + nx * depth} y1={startY + ny * depth} x2={endX + nx * depth} y2={endY + ny * depth} stroke="#e74c3c" strokeWidth={2} />
                  <text x={(startX + endX) / 2 + nx * (depth + 10)} y={(startY + endY) / 2 + ny * (depth + 10)} fontSize="9" fill="#e74c3c" textAnchor="middle">
                    {op.type === 'door' ? '门' : op.type === 'window' ? '窗' : op.type === 'sliding' ? '推拉门' : '垭口'} {op.widthMm}×{op.heightMm}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
            比例: 1:50 (A3纸张) | 总面积: {plan.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0).toFixed(2)}m²
          </div>
        </div>

        {/* Wall Outlet Plans */}
        {plan.rooms.map((room) => {
          const segs = getWallSegments(room);
          return (
            <div key={room.id} className="card print-page">
              <h2 style={{ marginBottom: 16, borderBottom: '2px solid #3498db', paddingBottom: 8 }}>
                {room.name} - 墙面点位图
              </h2>
              <svg width="100%" height={segs.length * 100 + 40}>
                {segs.map((seg, i) => {
                  const wallKey = `${room.id}-${i}`;
                  const outlets = plan.outlets.filter((o) => o.wallKey === wallKey);
                  const y = i * 100 + 30;
                  const scale = 700 / Math.max(seg.lengthMm, 1);

                  return (
                    <g key={i}>
                      <rect x={20} y={y} width={seg.lengthMm * scale} height={80} fill="#f8f9fa" stroke="#7f8c8d" strokeWidth={1} />
                      <text x={20} y={y - 6} fontSize="12" fill="#2c3e50" fontWeight="500">墙{i + 1} ({formatMm(seg.lengthMm)})</text>
                      {outlets.map((o) => {
                        const ox = 20 + o.xMm * scale;
                        const oy = y + 80 - (o.heightMm / room.heightMm) * 80;
                        const color = o.kind === 'socket' ? '#e74c3c' : o.kind === 'switch' ? '#3498db' : o.kind === 'net' ? '#9b59b6' : o.kind === 'light' ? '#f39c12' : '#1abc9c';
                        return (
                          <g key={o.id}>
                            <circle cx={ox} cy={oy} r={6} fill={color} stroke="white" strokeWidth={1.5} />
                            <text x={ox} y={oy - 10} fontSize="9" fill={color} textAnchor="middle">
                              {o.kind === 'socket' ? '插座' : o.kind === 'switch' ? '开关' : o.kind === 'net' ? '网口' : o.kind === 'light' ? '灯' : '水口'} {formatMm(o.heightMm)}
                              {o.circuit ? ` ${o.circuit}` : ''}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}

        {/* BOM */}
        <div className="card print-page">
          <h2 style={{ marginBottom: 16, borderBottom: '2px solid #3498db', paddingBottom: 8 }}>
            材料清单
          </h2>
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>材料名称</th>
                <th>单位</th>
                <th>数量</th>
                <th>单价</th>
                <th>总价</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const mat = plan.materials.find((m) => m.id === r.matId);
                return (
                  <tr key={r.matId}>
                    <td>{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.unit}</td>
                    <td>{r.quantity.toFixed(2)}</td>
                    <td>¥{mat?.price.toFixed(2) || 0}</td>
                    <td>¥{r.totalPrice.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan={5}>合计</td>
                <td>¥{totalPrice.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          .print-page {
            page-break-after: always;
            box-shadow: none;
            border: none;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
