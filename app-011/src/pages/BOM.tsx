import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { calcMaterials, calcPaintBuckets } from '../utils/materialCalc';
import { polygonPerimeter } from '../utils/geometry';
import type { MatSpec } from '../types';

export default function BOM() {
  const { id } = useParams<{ id: string }>();
  const { getPlan, updateMaterials } = useStore();
  const plan = getPlan(id!);
  const [editingMat, setEditingMat] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  const results = calcMaterials(plan.rooms, plan.openings, plan.materials);
  const totalPrice = results.reduce((s, r) => s + r.totalPrice, 0);

  const handlePriceUpdate = (matId: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price)) return;
    updateMaterials(
      plan.id,
      plan.materials.map((m) => (m.id === matId ? { ...m, price } : m))
    );
    setEditingMat(null);
  };

  const copyTable = () => {
    const lines = [
      '材料名称\t单位\t数量\t单价\t总价\t说明',
      ...results.map(
        (r) => `${r.name}\t${r.unit}\t${r.quantity.toFixed(2)}\t${plan.materials.find((m) => m.id === r.matId)?.price || 0}\t${r.totalPrice.toFixed(2)}\t${r.details}`
      ),
      `\t\t\t总计:\t${totalPrice.toFixed(2)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    alert('已复制为制表符分隔文本，可粘贴到Word/Excel');
  };

  return (
    <div>
      <h2 className="page-title">{plan.name} - 材料清单与预算</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab active">
          材料清单
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">
          导出打印
        </Link>
      </div>

      <div className="info-bar">
        <span>
          材料项: <strong>{results.length}</strong>
        </span>
        <span>
          预算总计: <strong style={{ color: '#e74c3c', fontSize: 18 }}>¥{totalPrice.toFixed(2)}</strong>
        </span>
      </div>

      <div className="toolbar no-print">
        <button className="btn btn-primary" onClick={copyTable}>
          复制表格文本
        </button>
        <Link className="btn btn-secondary" to={`/plan/${id}/print`}>
          打印视图
        </Link>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>材料名称</th>
              <th>单位</th>
              <th>数量</th>
              <th>单价</th>
              <th>总价</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const mat = plan.materials.find((m) => m.id === r.matId);
              const isEditing = editingMat === r.matId;
              return (
                <tr key={r.matId}>
                  <td>{r.name}</td>
                  <td>{r.unit}</td>
                  <td>{r.quantity.toFixed(2)}</td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onBlur={() => handlePriceUpdate(r.matId)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(r.matId)}
                        autoFocus
                        style={{ width: 80 }}
                      />
                    ) : (
                      <span onClick={() => { setEditingMat(r.matId); setEditPrice(String(mat?.price || 0)); }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        ¥{mat?.price.toFixed(2) || 0}
                      </span>
                    )}
                  </td>
                  <td>¥{r.totalPrice.toFixed(2)}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => { setEditingMat(r.matId); setEditPrice(String(mat?.price || 0)); }}>
                      改价
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
              <td colSpan={4}>合计</td>
              <td colSpan={2}>¥{totalPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>计算明细</h3>
        {results.map((r) => (
          <div key={r.matId} style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
            <strong>{r.name}</strong>: {r.details}
          </div>
        ))}
      </div>

      <PaintCalc rooms={plan.rooms} openings={plan.openings} materials={plan.materials} />
    </div>
  );
}

function PaintCalc({
  rooms,
  openings,
  materials,
}: {
  rooms: { id: string; name: string; polygon: { x: number; y: number }[]; heightMm: number }[];
  openings: { roomId: string; widthMm: number; heightMm: number }[];
  materials: MatSpec[];
}) {
  const paintMat = materials.find((m) => m.id === 'paint');
  const primerMat = materials.find((m) => m.id === 'primer');
  if (!paintMat) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>油漆用量详细计算</h3>
      {rooms.map((room) => {
        const perim = polygonPerimeter(room.polygon);
        const wallArea = perim * room.heightMm;
        const roomOpenings = openings.filter((o) => o.roomId === room.id);
        const openingArea = roomOpenings.reduce((s, o) => s + o.widthMm * o.heightMm, 0);
        const netArea = Math.max(0, wallArea - openingArea);
        const buckets = calcPaintBuckets(netArea / 1000000, paintMat.coverage || 12);
        const primerBuckets = primerMat ? calcPaintBuckets(netArea / 1000000, primerMat.coverage || 14) : 0;

        return (
          <div key={room.id} style={{ marginBottom: 12, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{room.name}</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              周长{perim.toFixed(0)}mm × 层高{room.heightMm}mm = {wallArea.toFixed(0)}mm²
              <br />
              扣门窗{openingArea.toFixed(0)}mm² → 净面积{netArea.toFixed(0)}mm² ({(netArea / 1000000).toFixed(2)}m²)
              <br />
              面漆: {buckets}桶 (每桶覆盖{paintMat.coverage}m²)
              {primerMat && <span> | 底漆: {primerBuckets}桶</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
