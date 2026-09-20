import { useMemo, useState, type CSSProperties } from 'react';
import { useStore } from '../store';
import type { Room, Opening } from '../types';
import { getWallSegments } from '../utils/geometry';
import {
  OPENING_TYPE_LABEL,
  scanOpenings,
  toOpeningShape,
  validateOpeningDraft,
  wallLabel,
  type OpeningIssue,
} from '../utils/openingValidation';

interface Props {
  planId: string;
  rooms: Room[];
  openings: Opening[];
}

interface FormState {
  roomId: string;
  wallIndex: string;
  offsetMm: string;
  widthMm: string;
  heightMm: string;
  sillMm: string;
  type: Opening['type'];
}

const emptyForm: FormState = {
  roomId: '',
  wallIndex: '0',
  offsetMm: '0',
  widthMm: '900',
  heightMm: '2100',
  sillMm: '0',
  type: 'door',
};

const TYPE_OPTIONS: Array<{ value: Opening['type']; label: string }> = [
  { value: 'door', label: '门（落地）' },
  { value: 'sliding', label: '推拉门（落地）' },
  { value: 'arch', label: '垭口（落地）' },
  { value: 'window', label: '窗（填离地高度）' },
];

export default function OpeningEditor({ planId, rooms, openings }: Props) {
  const { addOpening, updateOpening, deleteOpening } = useStore();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<OpeningIssue[]>([]);
  /** 非空表示正在挪动/修改这个洞口，而不是新增 */
  const [editingId, setEditingId] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedRoom = rooms.find((r) => r.id === form.roomId);
  const wallSegs = selectedRoom ? getWallSegments(selectedRoom) : [];

  // 已存数据体检：rooms/openings 变化时自动重扫，一次列出哪些越界、哪些互相压着
  const scan = useMemo(() => scanOpenings(rooms, openings), [rooms, openings]);
  const badMap = useMemo(() => {
    const m = new Map<string, OpeningIssue[]>();
    for (const b of scan.bad) m.set(b.opening.id, b.issues);
    return m;
  }, [scan]);

  const changeType = (t: Opening['type']) => {
    // 切到窗给个常用窗台高默认值，切回落地洞口强制归零，用户仍可改
    setForm((f) => {
      if (t === 'window') {
        return { ...f, type: t, sillMm: f.sillMm === '0' || f.sillMm === '' ? '900' : f.sillMm };
      }
      return { ...f, type: t, sillMm: '0' };
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors([]);
    setEditingId(null);
  };

  const handleSubmit = () => {
    const result = validateOpeningDraft(form, rooms, openings.map(toOpeningShape), editingId ?? undefined);
    if (!result.ok || !result.draft) {
      // 越界就把哪面墙、差了多少说清楚，并且不写进方案
      setErrors(result.issues);
      return;
    }
    setErrors([]);

    if (editingId) {
      const r = updateOpening(planId, editingId, () => ({
        id: editingId,
        roomId: result.draft!.roomId,
        wallIndex: result.draft!.wallIndex,
        offsetMm: result.draft!.offsetMm,
        widthMm: result.draft!.widthMm,
        heightMm: result.draft!.heightMm,
        sillMm: result.draft!.sillMm,
        type: result.draft!.type,
      }));
      if (!r.ok) {
        setErrors(r.messages.map((message) => ({ code: 'overlap' as const, message })));
        return;
      }
      resetForm();
    } else {
      const op: Opening = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        roomId: result.draft.roomId,
        wallIndex: result.draft.wallIndex,
        offsetMm: result.draft.offsetMm,
        widthMm: result.draft.widthMm,
        heightMm: result.draft.heightMm,
        sillMm: result.draft.sillMm,
        type: result.draft.type,
      };
      const r = addOpening(planId, op);
      if (!r.ok) {
        setErrors(r.messages.map((message) => ({ code: 'overlap' as const, message })));
        return;
      }
      // 保留房间/墙/类型，只清空起点偏移，方便在同一面墙上连续添加
      setForm((f) => ({ ...f, offsetMm: '0' }));
    }
  };

  const startEdit = (op: Opening) => {
    setEditingId(op.id);
    setForm({
      roomId: op.roomId,
      wallIndex: String(op.wallIndex),
      offsetMm: String(op.offsetMm),
      widthMm: String(op.widthMm),
      heightMm: String(op.heightMm),
      sillMm: String(op.sillMm ?? 0),
      type: op.type,
    });
    setErrors([]);
  };

  const roomOpenings = openings.filter((o) => o.roomId === form.roomId);
  const roomName = selectedRoom?.name ?? '';

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>
        {editingId ? '挪动 / 修改洞口' : '门窗开洞'}
      </h3>

      {/* 已存数据体检结果 */}
      {scan.bad.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            border: '1px solid #e74c3c',
            borderRadius: 4,
            background: '#fdf0ef',
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, color: '#c0392b', marginBottom: 6 }}>
            体检发现 {scan.bad.length} 个洞口有问题（共 {scan.issueCount} 处）：越界/超顶/互相压着的
            洞口不参与墙面扣面积，请挪位置或删除
          </div>
          {scan.bad.map((s) => {
            const wl = s.room ? wallLabel(s.room.name, s.opening.wallIndex) : '（房间已删）';
            return (
              <div key={s.opening.id} style={{ borderTop: '1px dashed #e6b0aa', padding: '6px 0' }}>
                <div style={{ fontWeight: 500, color: '#2c3e50' }}>
                  {wl}
                  {OPENING_TYPE_LABEL[s.opening.type]}
                </div>
                {s.issues.map((iss, i) => (
                  <div key={i} style={{ color: '#c0392b', paddingLeft: 8 }}>
                    · {iss.message}
                  </div>
                ))}
                <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => startEdit(s.opening)}>
                    挪位置
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '2px 10px', fontSize: 12 }}
                    onClick={() => {
                      deleteOpening(planId, s.opening.id);
                      if (editingId === s.opening.id) resetForm();
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="form-group">
        <label>选择房间</label>
        <select value={form.roomId} onChange={(e) => { set('roomId', e.target.value); set('wallIndex', '0'); }}>
          <option value="">请选择房间</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}（层高 {r.heightMm}mm）
            </option>
          ))}
        </select>
      </div>

      {selectedRoom && (
        <>
          <div className="form-group">
            <label>墙体</label>
            <select value={form.wallIndex} onChange={(e) => set('wallIndex', e.target.value)}>
              {wallSegs.map((s, i) => (
                <option key={i} value={i}>
                  墙{i + 1}（长 {s.lengthMm.toFixed(0)}mm）
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>类型</label>
            <select value={form.type} onChange={(e) => changeType(e.target.value as Opening['type'])}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>起点偏移：距墙左端 (mm)</label>
            <input
              value={form.offsetMm}
              onChange={(e) => set('offsetMm', e.target.value)}
              inputMode="numeric"
              style={fieldStyle(errors, 'offsetMm')}
            />
          </div>
          <div className="form-group">
            <label>宽度 (mm)</label>
            <input
              value={form.widthMm}
              onChange={(e) => set('widthMm', e.target.value)}
              inputMode="numeric"
              style={fieldStyle(errors, 'widthMm')}
            />
          </div>
          <div className="form-group">
            <label>高度 (mm)</label>
            <input
              value={form.heightMm}
              onChange={(e) => set('heightMm', e.target.value)}
              inputMode="numeric"
              style={fieldStyle(errors, 'heightMm')}
            />
          </div>
          <div className="form-group">
            <label>离地高度 / 窗台高 (mm)，门和垭口必须填 0</label>
            <input
              value={form.sillMm}
              onChange={(e) => set('sillMm', e.target.value)}
              inputMode="numeric"
              disabled={form.type !== 'window'}
              style={fieldStyle(errors, 'sillMm')}
            />
          </div>

          {errors.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                border: '1px solid #e74c3c',
                borderRadius: 4,
                background: '#fdf0ef',
                color: '#c0392b',
                fontSize: 12,
              }}
            >
              {errors.map((iss, i) => (
                <div key={i}>· {iss.message}</div>
              ))}
              <div style={{ marginTop: 4, color: '#999' }}>洞口未写入方案，改对后再提交。</div>
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
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>
            {roomName}已添加洞口（{roomOpenings.length}）
          </h4>
          {roomOpenings.map((op) => {
            const issues = badMap.get(op.id);
            return (
              <div
                key={op.id}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid #ecf0f1',
                  fontSize: 13,
                  background: issues ? '#fdf0ef' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: issues ? '#c0392b' : undefined }}>
                    {editingId === op.id ? '✏️ ' : ''}
                    {OPENING_TYPE_LABEL[op.type]} 墙{op.wallIndex + 1} 起点{op.offsetMm} {op.widthMm}×
                    {op.heightMm}
                    {op.sillMm ? ` 离地${op.sillMm}` : ''}
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => startEdit(op)}>
                      修改
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '2px 10px', fontSize: 12 }}
                      onClick={() => {
                        deleteOpening(planId, op.id);
                        if (editingId === op.id) resetForm();
                      }}
                    >
                      删除
                    </button>
                  </span>
                </div>
                {issues?.map((iss, i) => (
                  <div key={i} style={{ color: '#c0392b', fontSize: 12, paddingLeft: 4 }}>
                    · {iss.message}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fieldStyle(errors: OpeningIssue[], field: OpeningIssue['field']): CSSProperties {
  return errors.some((e) => e.field === field) ? { borderColor: '#e74c3c', background: '#fdf0ef' } : {};
}
