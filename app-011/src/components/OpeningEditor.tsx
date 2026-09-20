import { useState } from 'react';
import { useStore } from '../store';
import type { Room, Opening } from '../types';
import { getWallSegments } from '../utils/geometry';
import {
  OPENING_LIMITS,
  OPENING_TYPE_NAMES,
  openingLabel,
  parseMmField,
  scanOpenings,
  validateOpening,
  type OpeningIssue,
} from '../utils/openingValidation';

interface Props {
  planId: string;
  rooms: Room[];
  openings: Opening[];
}

export default function OpeningEditor({ planId, rooms, openings }: Props) {
  const { addOpening, updateOpening, deleteOpening } = useStore();
  const [roomId, setRoomId] = useState('');
  const [wallIndex, setWallIndex] = useState('0');
  const [offsetMm, setOffsetMm] = useState('0');
  const [widthMm, setWidthMm] = useState('900');
  const [heightMm, setHeightMm] = useState('2100');
  const [sillMm, setSillMm] = useState('0');
  const [type, setType] = useState<Opening['type']>('door');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<OpeningIssue[]>([]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const wallSegs = selectedRoom ? getWallSegments(selectedRoom) : [];
  const currentWall = wallSegs[parseInt(wallIndex)];

  const resetForm = () => {
    setEditingId(null);
    setErrors([]);
    setOffsetMm('0');
    setWidthMm('900');
    setHeightMm('2100');
    setSillMm('0');
    setType('door');
  };

  const startEdit = (op: Opening) => {
    setEditingId(op.id);
    setRoomId(op.roomId);
    setWallIndex(String(op.wallIndex));
    setOffsetMm(String(op.offsetMm));
    setWidthMm(String(op.widthMm));
    setHeightMm(String(op.heightMm));
    setSillMm(String(op.sillHeightMm ?? 0));
    setType(op.type);
    setErrors([]);
  };

  const handleSubmit = () => {
    if (!selectedRoom) return;

    // 严格解析：字母、空串先拦下，不再 parseInt || 0 静默吞掉
    const fields = [
      parseMmField('偏移', offsetMm),
      parseMmField('宽度', widthMm),
      parseMmField('高度', heightMm),
      parseMmField('离地高度', sillMm),
    ];
    const parseIssues = fields.flatMap((f) => (f.issue ? [f.issue] : []));
    if (parseIssues.length > 0) {
      setErrors(parseIssues);
      return;
    }
    const [offset, width, height, sill] = fields.map((f) => f.value!);

    const candidate: Opening = {
      id: editingId ?? Math.random().toString(36).slice(2),
      roomId,
      wallIndex: parseInt(wallIndex),
      offsetMm: offset,
      widthMm: width,
      heightMm: height,
      sillHeightMm: sill,
      type,
    };

    // 收下之前先过一遍：越界/重叠的一律不写进方案
    const issues = validateOpening(selectedRoom, openings, candidate, editingId ?? undefined);
    if (issues.length > 0) {
      setErrors(issues);
      return;
    }

    if (editingId) {
      updateOpening(planId, editingId, () => candidate);
    } else {
      addOpening(planId, candidate);
    }
    resetForm();
  };

  const roomOpenings = openings.filter((o) => o.roomId === roomId);
  // 一次扫出方案里所有越界/互相压着的存量洞口
  const problems = scanOpenings(rooms, openings);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>门窗开洞</h3>

      <div className="form-group">
        <label>选择房间</label>
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">请选择房间</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {selectedRoom && (
        <>
          <div className="form-group">
            <label>墙体 ({wallSegs.length}面)</label>
            <select value={wallIndex} onChange={(e) => setWallIndex(e.target.value)}>
              {wallSegs.map((s, i) => (
                <option key={i} value={i}>
                  墙{i + 1} ({s.lengthMm.toFixed(0)}mm)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>类型</label>
            <select value={type} onChange={(e) => setType(e.target.value as Opening['type'])}>
              <option value="door">门</option>
              <option value="window">窗</option>
              <option value="sliding">推拉门</option>
              <option value="arch">垭口</option>
            </select>
          </div>

          <div className="form-group">
            <label>偏移 (mm)</label>
            <input value={offsetMm} onChange={(e) => setOffsetMm(e.target.value)} />
          </div>
          <div className="form-group">
            <label>宽度 (mm)</label>
            <input value={widthMm} onChange={(e) => setWidthMm(e.target.value)} />
          </div>
          <div className="form-group">
            <label>高度 (mm)</label>
            <input value={heightMm} onChange={(e) => setHeightMm(e.target.value)} />
          </div>
          <div className="form-group">
            <label>离地高度 (mm)</label>
            <input value={sillMm} onChange={(e) => setSillMm(e.target.value)} />
          </div>

          <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            {currentWall && selectedRoom && (
              <>
                墙{parseInt(wallIndex) + 1}长 {Math.round(currentWall.lengthMm)}mm · 层高{' '}
                {selectedRoom.heightMm}mm ·{' '}
              </>
            )}
            可施工范围：宽 {OPENING_LIMITS.widthMm.min}~{OPENING_LIMITS.widthMm.max}mm，高{' '}
            {OPENING_LIMITS.heightMm.min}~{OPENING_LIMITS.heightMm.max}mm，离地{' '}
            {OPENING_LIMITS.sillHeightMm.min}~{OPENING_LIMITS.sillHeightMm.max}mm
          </div>

          {errors.length > 0 && (
            <div
              style={{
                background: '#fdedec',
                border: '1px solid #e74c3c',
                borderRadius: 4,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ color: '#c0392b', fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                未保存，请先修正：
              </div>
              <ul style={{ paddingLeft: 18 }}>
                {errors.map((e, i) => (
                  <li key={i} style={{ color: '#c0392b', fontSize: 13, marginTop: 2 }}>
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }}>
              {editingId ? '保存修改' : '添加洞口'}
            </button>
            {editingId && (
              <button className="btn btn-secondary" onClick={resetForm}>
                取消
              </button>
            )}
          </div>
        </>
      )}

      {roomOpenings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>已添加洞口</h4>
          {roomOpenings.map((op) => (
            <div
              key={op.id}
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
                {OPENING_TYPE_NAMES[op.type]} 墙{op.wallIndex + 1} {op.widthMm}×{op.heightMm}
                {(op.sillHeightMm ?? 0) > 0 && ` 离地${op.sillHeightMm}`}
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-secondary" onClick={() => startEdit(op)}>
                  修改
                </button>
                <button className="btn btn-danger" onClick={() => deleteOpening(planId, op.id)}>
                  删除
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {problems.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8, color: '#c0392b' }}>
            ⚠ 已存洞口体检：{problems.length} 个越界/重叠
          </h4>
          {problems.map(({ opening: op, roomName, issues }) => (
            <div
              key={op.id}
              style={{
                border: '1px solid #e74c3c',
                borderRadius: 4,
                padding: 8,
                marginBottom: 8,
                background: '#fdedec',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {roomName ? `房间"${roomName}" ` : ''}墙{op.wallIndex + 1} · {openingLabel(op)}
              </div>
              <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
                {issues.map((iss, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#c0392b' }}>
                    {iss.message}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 4 }}>
                {roomName && (
                  <button className="btn btn-secondary" onClick={() => startEdit(op)}>
                    挪位置
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => deleteOpening(planId, op.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
