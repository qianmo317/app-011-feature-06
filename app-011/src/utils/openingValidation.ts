import type { Opening, OpeningType, Room, WallSegment } from '../types';
import { getWallSegments } from './geometry';

/**
 * 门窗洞口入册前的校验 + 已存数据体检。
 *
 * 规则：
 * 1. 落点（偏移）+ 宽度不能越过所在墙的两端；
 * 2. 同一面墙上的洞口不允许重叠（端头刚好相接不算重叠）；
 * 3. 宽度 / 高度 / 离地高度必须落在实际施工能做到的范围；
 * 4. 越界信息要说清楚是哪面墙、差了多少，由调用方决定是否写入方案。
 */

export const OPENING_TYPE_LABEL: Record<OpeningType, string> = {
  door: '门',
  window: '窗',
  sliding: '推拉门',
  arch: '垭口',
};

/** 各类洞口实际施工可做的尺寸范围（mm），超出即按填错处理 */
export const OPENING_LIMITS: Record<
  OpeningType,
  {
    label: string;
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
    /** 是否为落地洞口（门 / 推拉门 / 垭口离地高度必须为 0） */
    floorSill: boolean;
  }
> = {
  door: { label: '门', minWidthMm: 600, maxWidthMm: 1800, minHeightMm: 1900, maxHeightMm: 2400, floorSill: true },
  sliding: { label: '推拉门', minWidthMm: 800, maxWidthMm: 4000, minHeightMm: 1900, maxHeightMm: 2500, floorSill: true },
  arch: { label: '垭口', minWidthMm: 700, maxWidthMm: 3000, minHeightMm: 1900, maxHeightMm: 2500, floorSill: true },
  window: { label: '窗', minWidthMm: 400, maxWidthMm: 3000, minHeightMm: 400, maxHeightMm: 2400, floorSill: false },
};

/** 窗户离地高度（窗台高）允许范围，mm */
export const WINDOW_SILL_MAX_MM = 1200;

export type OpeningIssueCode =
  | 'room_missing'
  | 'wall_missing'
  | 'not_integer'
  | 'offset_negative'
  | 'width_out_of_range'
  | 'width_exceeds_wall'
  | 'height_out_of_range'
  | 'sill_floor_must_zero'
  | 'sill_out_of_range'
  | 'exceeds_wall_end'
  | 'exceeds_ceiling'
  | 'overlap';

export type OpeningField = 'offsetMm' | 'widthMm' | 'heightMm' | 'sillMm' | 'wallIndex';

export interface OpeningIssue {
  code: OpeningIssueCode;
  field?: OpeningField;
  /** 人能直接看懂的中文说明，含墙名与超出量 */
  message: string;
  /** 超出 / 相差的毫米数 */
  overMm?: number;
  /** 重叠时，压着的另一个洞口 id */
  otherOpeningId?: string;
}

export interface OpeningShape {
  id?: string;
  roomId: string;
  wallIndex: number;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  type: OpeningType;
}

/** 表单里还没解析的原始字符串 */
export interface RawOpeningDraft {
  roomId: string;
  wallIndex: string;
  offsetMm: string;
  widthMm: string;
  heightMm: string;
  sillMm: string;
  type: OpeningType;
}

export interface OpeningValidation {
  ok: boolean;
  issues: OpeningIssue[];
  draft?: OpeningShape;
}

/** 哪面墙的统一说法：「客厅·墙2」 */
export function wallLabel(roomName: string, wallIndex: number): string {
  return `「${roomName}·墙${wallIndex + 1}」`;
}

/** 已存洞口转成校验用形状；老数据没有 sillMm 按 0（落地）处理 */
export function toOpeningShape(o: Opening): OpeningShape {
  return {
    id: o.id,
    roomId: o.roomId,
    wallIndex: o.wallIndex,
    offsetMm: o.offsetMm,
    widthMm: o.widthMm,
    heightMm: o.heightMm,
    sillMm: o.sillMm ?? 0,
    type: o.type,
  };
}

/** 该洞口几何上是否有效（落在墙内、不超顶、数值正常），无效的不参与扣面积 */
export function openingGeomValid(o: Opening, room: Room): boolean {
  if (!Number.isInteger(o.wallIndex) || o.wallIndex < 0) return false;
  const seg = getWallSegments(room)[o.wallIndex];
  if (!seg) return false;
  return isOpeningGeomSafe(toOpeningShape(o), seg, room.heightMm);
}

/**
 * 严格解析毫米输入：空串、字母、小数、负数、科学计数法一律算非法，
 * 绝不再静默兜底成 0（之前 parseInt('abc') || 0 会把错值当 0 存进去）。
 */
export function parseMmInput(raw: string): { ok: true; value: number } | { ok: false } {
  const t = String(raw ?? '').trim();
  if (!/^\d+$/.test(t)) return { ok: false };
  const v = Number(t);
  if (!Number.isSafeInteger(v)) return { ok: false };
  return { ok: true, value: v };
}

/**
 * 洞口几何上是否安全（数值正常、不越墙端、不超层高）。
 * 只看“扣面积会不会算错”，不看常用尺寸范围等工艺约束。
 */
export function isOpeningGeomSafe(o: OpeningShape, seg: WallSegment, roomHeightMm: number): boolean {
  return (
    Number.isFinite(o.offsetMm) &&
    Number.isFinite(o.widthMm) &&
    Number.isFinite(o.heightMm) &&
    Number.isFinite(o.sillMm) &&
    o.offsetMm >= 0 &&
    o.widthMm > 0 &&
    o.heightMm > 0 &&
    o.sillMm >= 0 &&
    o.offsetMm + o.widthMm <= seg.lengthMm + 1e-6 &&
    o.sillMm + o.heightMm <= roomHeightMm + 1e-6
  );
}

function findSeg(rooms: Room[], roomId: string, wallIndex: number): { room?: Room; seg?: WallSegment } {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || !Number.isInteger(wallIndex) || wallIndex < 0) return {};
  const seg = getWallSegments(room)[wallIndex];
  return seg ? { room, seg } : { room };
}

/**
 * 对一个数值已经解析好的洞口做全部规则检查（尺寸范围、越界、超顶、重叠）。
 * existing 是同一方案里已经存在的洞口；excludeId 用于挪动洞口时排除自己。
 */
export function checkOpening(
  draft: OpeningShape,
  rooms: Room[],
  existing: readonly OpeningShape[],
  excludeId?: string
): OpeningIssue[] {
  const { room, seg } = findSeg(rooms, draft.roomId, draft.wallIndex);
  if (!room) {
    return [
      {
        code: 'room_missing',
        message: `洞口引用的房间不存在（房间 id：${draft.roomId || '空'}），可能房间已被删除`,
      },
    ];
  }
  if (!seg) {
    return [
      {
        code: 'wall_missing',
        field: 'wallIndex',
        message: `${room.name} 只有 ${getWallSegments(room).length} 面墙，墙${draft.wallIndex + 1}不存在`,
      },
    ];
  }

  const limits = OPENING_LIMITS[draft.type];
  const wl = wallLabel(room.name, draft.wallIndex);
  const issues: OpeningIssue[] = [];
  const length = seg.lengthMm;

  // —— 偏移 ——
  if (draft.offsetMm < 0) {
    issues.push({
      code: 'offset_negative',
      field: 'offsetMm',
      message: `${wl}${limits.label}的起点偏移不能为负（当前填的是 ${draft.offsetMm}mm）`,
      overMm: -draft.offsetMm,
    });
  }

  // —— 宽度：先看是否在该类型实际能做的范围 ——
  if (draft.widthMm < limits.minWidthMm || draft.widthMm > limits.maxWidthMm) {
    if (draft.widthMm < limits.minWidthMm) {
      issues.push({
        code: 'width_out_of_range',
        field: 'widthMm',
        message: `${wl}${limits.label}宽 ${draft.widthMm}mm 小到做不出来，实际范围 ${limits.minWidthMm}~${limits.maxWidthMm}mm，至少还差 ${limits.minWidthMm - draft.widthMm}mm`,
        overMm: limits.minWidthMm - draft.widthMm,
      });
    } else {
      issues.push({
        code: 'width_out_of_range',
        field: 'widthMm',
        message: `${wl}${limits.label}宽 ${draft.widthMm}mm 超出实际范围上限 ${limits.maxWidthMm}mm，多出 ${draft.widthMm - limits.maxWidthMm}mm`,
        overMm: draft.widthMm - limits.maxWidthMm,
      });
    }
  }

  // —— 宽度不能超过这面墙本身 ——
  if (draft.widthMm > length) {
    issues.push({
      code: 'width_exceeds_wall',
      field: 'widthMm',
      message: `${wl}${limits.label}宽 ${draft.widthMm}mm，但这面墙只有 ${length.toFixed(0)}mm，墙放不下，宽出 ${(draft.widthMm - length).toFixed(0)}mm`,
      overMm: draft.widthMm - length,
    });
  }

  // —— 落点 + 宽度越过墙的右端 ——
  if (draft.offsetMm >= 0 && draft.widthMm > 0) {
    const end = draft.offsetMm + draft.widthMm;
    if (end > length + 1e-6) {
      const over = end - length;
      issues.push({
        code: 'exceeds_wall_end',
        field: 'offsetMm',
        message: `${wl}${limits.label}从起点 ${draft.offsetMm}mm 起宽 ${draft.widthMm}mm，末端到 ${end}mm，越过墙端 ${length.toFixed(0)}mm 共 ${over.toFixed(0)}mm；把偏移往左挪至少 ${over.toFixed(0)}mm，或把宽度缩到 ${(draft.widthMm - over).toFixed(0)}mm 以内`,
        overMm: over,
      });
    }
  }

  // —— 高度：实际能做的范围 ——
  if (draft.heightMm < limits.minHeightMm || draft.heightMm > limits.maxHeightMm) {
    if (draft.heightMm < limits.minHeightMm) {
      issues.push({
        code: 'height_out_of_range',
        field: 'heightMm',
        message: `${wl}${limits.label}高 ${draft.heightMm}mm 小到做不出来，实际范围 ${limits.minHeightMm}~${limits.maxHeightMm}mm，至少还差 ${limits.minHeightMm - draft.heightMm}mm`,
        overMm: limits.minHeightMm - draft.heightMm,
      });
    } else {
      issues.push({
        code: 'height_out_of_range',
        field: 'heightMm',
        message: `${wl}${limits.label}高 ${draft.heightMm}mm 超出实际范围上限 ${limits.maxHeightMm}mm，多出 ${draft.heightMm - limits.maxHeightMm}mm`,
        overMm: draft.heightMm - limits.maxHeightMm,
      });
    }
  }

  // —— 离地高度 ——
  if (limits.floorSill) {
    if (draft.sillMm !== 0) {
      issues.push({
        code: 'sill_floor_must_zero',
        field: 'sillMm',
        message: `${wl}${limits.label}是落地洞口，离地高度必须为 0（当前填的是 ${draft.sillMm}mm）`,
        overMm: draft.sillMm,
      });
    }
  } else if (draft.sillMm > WINDOW_SILL_MAX_MM) {
    issues.push({
      code: 'sill_out_of_range',
      field: 'sillMm',
      message: `${wl}窗的离地高度 ${draft.sillMm}mm 超过 ${WINDOW_SILL_MAX_MM}mm，窗顶都要钻出墙外了，多出 ${draft.sillMm - WINDOW_SILL_MAX_MM}mm`,
      overMm: draft.sillMm - WINDOW_SILL_MAX_MM,
    });
  }

  // —— 洞口顶部不能超过层高 ——
  if (draft.heightMm > 0 && draft.sillMm >= 0) {
    const top = draft.sillMm + draft.heightMm;
    if (top > room.heightMm + 1e-6) {
      const over = top - room.heightMm;
      issues.push({
        code: 'exceeds_ceiling',
        field: 'heightMm',
        message: `${wl}${limits.label}离地 ${draft.sillMm}mm + 高 ${draft.heightMm}mm，顶部到 ${top}mm，超过该房间层高 ${room.heightMm}mm 共 ${over.toFixed(0)}mm`,
        overMm: over,
      });
    }
  }

  // —— 同一面墙上不许重叠 ——
  if (draft.offsetMm >= 0 && draft.widthMm > 0) {
    const start = draft.offsetMm;
    const end = draft.offsetMm + draft.widthMm;
    for (const other of existing) {
      if (other.id && excludeId && other.id === excludeId) continue;
      if (other.roomId !== draft.roomId || other.wallIndex !== draft.wallIndex) continue;
      if (other.offsetMm < 0 || other.widthMm <= 0) continue;
      const oStart = other.offsetMm;
      const oEnd = other.offsetMm + other.widthMm;
      // 端头刚好相接（end == oStart）不算压着
      if (start < oEnd - 1e-6 && oStart < end - 1e-6) {
        const overlapLen = Math.min(end, oEnd) - Math.max(start, oStart);
        const otherLabel = OPENING_TYPE_LABEL[other.type] || '洞口';
        issues.push({
          code: 'overlap',
          message: `${wl}${limits.label}（${start}~${end}mm）与已有的${otherLabel}（${oStart}~${oEnd}mm）互相压着 ${overlapLen.toFixed(0)}mm，请挪开或改窄`,
          overMm: overlapLen,
          otherOpeningId: other.id,
        });
      }
    }
  }

  return issues;
}

/**
 * 表单提交入口：先把字符串严格解析成毫米数（字母/负数/小数直接拦），
 * 再走全部规则。任何一项不过都返回 ok:false，调用方不得写入方案。
 */
export function validateOpeningDraft(
  raw: RawOpeningDraft,
  rooms: Room[],
  existing: readonly OpeningShape[],
  excludeId?: string
): OpeningValidation {
  const issues: OpeningIssue[] = [];
  const room = rooms.find((r) => r.id === raw.roomId);

  if (!raw.roomId || !room) {
    return {
      ok: false,
      issues: [{ code: 'room_missing', message: '请先选择房间' }],
    };
  }

  const wallIndex = Number(raw.wallIndex);
  if (!Number.isInteger(wallIndex) || wallIndex < 0 || !getWallSegments(room)[wallIndex]) {
    return {
      ok: false,
      issues: [
        {
          code: 'wall_missing',
          field: 'wallIndex',
          message: `${room.name} 上不存在墙${Number(raw.wallIndex) + 1}，请重新选墙`,
        },
      ],
    };
  }

  const wl = wallLabel(room.name, wallIndex);
  const fields: Array<{ key: OpeningField; label: string; raw: string }> = [
    { key: 'offsetMm', label: '起点偏移', raw: raw.offsetMm },
    { key: 'widthMm', label: '宽度', raw: raw.widthMm },
    { key: 'heightMm', label: '高度', raw: raw.heightMm },
    { key: 'sillMm', label: '离地高度', raw: raw.sillMm },
  ];
  const parsed: Record<OpeningField, number> = {
    offsetMm: 0,
    widthMm: 0,
    heightMm: 0,
    sillMm: 0,
    wallIndex,
  };

  for (const f of fields) {
    const r = parseMmInput(f.raw);
    if (!r.ok) {
      issues.push({
        code: 'not_integer',
        field: f.key,
        message: `${wl}${f.label}「${f.raw.trim()}」不是有效的非负整数毫米值（不能填字母、负数或小数），该项无法入册`,
      });
    } else {
      parsed[f.key] = r.value;
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const draft: OpeningShape = {
    roomId: raw.roomId,
    wallIndex,
    offsetMm: parsed.offsetMm,
    widthMm: parsed.widthMm,
    heightMm: parsed.heightMm,
    sillMm: parsed.sillMm,
    type: raw.type,
  };

  const ruleIssues = checkOpening(draft, rooms, existing, excludeId);
  return { ok: ruleIssues.length === 0, issues: ruleIssues, draft: ruleIssues.length === 0 ? draft : undefined };
}

export interface ScannedOpening {
  opening: Opening;
  room?: Room;
  seg?: WallSegment;
  issues: OpeningIssue[];
}

export interface ScanResult {
  all: ScannedOpening[];
  bad: ScannedOpening[];
  issueCount: number;
  ok: boolean;
}

/**
 * 一次性扫描方案里已经存下来的全部洞口：
 * 哪些越界、超顶、压着，全部带墙名和超出量列出来，由人决定挪还是删。
 * 老数据没有 sillMm 字段时按 0（落地）处理。
 */
export function scanOpenings(rooms: Room[], openings: Opening[]): ScanResult {
  const shapes: OpeningShape[] = openings.map(toOpeningShape);

  const all: ScannedOpening[] = openings.map((opening, i) => {
    const { room, seg } = findSeg(rooms, opening.roomId, opening.wallIndex);
    const issues = checkOpening(shapes[i], rooms, shapes, opening.id);
    return { opening, room, seg, issues };
  });

  const bad = all.filter((s) => s.issues.length > 0);
  const issueCount = bad.reduce((n, s) => n + s.issues.length, 0);
  return { all, bad, issueCount, ok: bad.length === 0 };
}
