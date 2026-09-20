import type { Opening, OpeningType, Room } from '../types';
import { getWallSegments } from './geometry';

/** 洞口类型中文名 */
export const OPENING_TYPE_NAMES: Record<OpeningType, string> = {
  door: '门',
  window: '窗',
  sliding: '推拉门',
  arch: '垭口',
};

/** 实际能做到的尺寸范围 (mm) */
export const OPENING_LIMITS = {
  widthMm: { min: 100, max: 4000 },
  heightMm: { min: 300, max: 3000 },
  sillHeightMm: { min: 0, max: 1500 },
} as const;

export type OpeningIssueKind =
  | 'not-a-number'
  | 'out-of-range'
  | 'wall-overflow'
  | 'height-overflow'
  | 'no-such-wall'
  | 'no-such-room'
  | 'overlap';

export interface OpeningIssue {
  kind: OpeningIssueKind;
  message: string;
}

/** 存量数据扫出来的问题洞口 */
export interface OpeningProblem {
  opening: Opening;
  /** 房间已删除时为 undefined */
  roomName?: string;
  issues: OpeningIssue[];
}

/** 洞口标签，如：门 900×2100@300 */
export function openingLabel(op: Opening): string {
  return `${OPENING_TYPE_NAMES[op.type]} ${op.widthMm}×${op.heightMm}@${op.offsetMm}`;
}

function wallLabel(room: Room, wallIndex: number): string {
  return `房间"${room.name}" 墙${wallIndex + 1}`;
}

/**
 * 严格解析 mm 输入：空串、字母、夹杂字符都算无效，
 * 不再像 parseInt || 0 那样把 "abc"、"-5" 静默吞成 0。
 */
export function parseMmField(
  label: string,
  raw: string
): { value?: number; issue?: OpeningIssue } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { issue: { kind: 'not-a-number', message: `请填写${label}` } };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { issue: { kind: 'not-a-number', message: `${label}"${raw}"不是有效数字` } };
  }
  return { value };
}

/**
 * 收下之前的体检：落点+宽度不越墙、同墙洞口不重叠、
 * 宽/高/离地高度落在可施工范围且总高不超过层高。
 * 每条问题都说清是哪面墙、差了多少。返回空数组表示通过。
 *
 * @param excludeId 编辑已有洞口时传入自身 id，重叠检查跳过自己
 */
export function validateOpening(
  room: Room,
  existing: Opening[],
  candidate: Opening,
  excludeId?: string
): OpeningIssue[] {
  const issues: OpeningIssue[] = [];
  const segs = getWallSegments(room);
  const wallIdx = candidate.wallIndex;

  if (!Number.isInteger(wallIdx) || wallIdx < 0 || wallIdx >= segs.length) {
    issues.push({
      kind: 'no-such-wall',
      message: `房间"${room.name}"没有墙${wallIdx + 1}（共 ${segs.length} 面墙）`,
    });
    return issues;
  }
  const wall = segs[wallIdx];
  const where = wallLabel(room, wallIdx);

  const offset = candidate.offsetMm;
  const width = candidate.widthMm;
  const height = candidate.heightMm;
  const sill = candidate.sillHeightMm ?? 0;

  // NaN/Infinity 没法继续算，直接拦下
  const nums: Array<[string, number]> = [
    ['偏移', offset],
    ['宽度', width],
    ['高度', height],
    ['离地高度', sill],
  ];
  for (const [label, v] of nums) {
    if (!Number.isFinite(v)) {
      issues.push({ kind: 'not-a-number', message: `${where}：${label}不是有效数字` });
    }
  }
  if (issues.length > 0) return issues;

  // 可施工范围
  if (width <= 0) {
    issues.push({ kind: 'out-of-range', message: `${where}：宽度必须大于 0（当前 ${width}mm）` });
  } else if (width < OPENING_LIMITS.widthMm.min) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：宽度 ${width}mm 低于可施工下限 ${OPENING_LIMITS.widthMm.min}mm（差 ${OPENING_LIMITS.widthMm.min - width}mm）`,
    });
  } else if (width > OPENING_LIMITS.widthMm.max) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：宽度 ${width}mm 超出可施工上限 ${OPENING_LIMITS.widthMm.max}mm（超出 ${width - OPENING_LIMITS.widthMm.max}mm）`,
    });
  }

  if (height <= 0) {
    issues.push({ kind: 'out-of-range', message: `${where}：高度必须大于 0（当前 ${height}mm）` });
  } else if (height < OPENING_LIMITS.heightMm.min) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：高度 ${height}mm 低于可施工下限 ${OPENING_LIMITS.heightMm.min}mm（差 ${OPENING_LIMITS.heightMm.min - height}mm）`,
    });
  } else if (height > OPENING_LIMITS.heightMm.max) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：高度 ${height}mm 超出可施工上限 ${OPENING_LIMITS.heightMm.max}mm（超出 ${height - OPENING_LIMITS.heightMm.max}mm）`,
    });
  }

  if (sill < OPENING_LIMITS.sillHeightMm.min) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：离地高度不能小于 0（当前 ${sill}mm）`,
    });
  } else if (sill > OPENING_LIMITS.sillHeightMm.max) {
    issues.push({
      kind: 'out-of-range',
      message: `${where}：离地高度 ${sill}mm 超出可施工上限 ${OPENING_LIMITS.sillHeightMm.max}mm（超出 ${sill - OPENING_LIMITS.sillHeightMm.max}mm）`,
    });
  }

  if (offset < 0) {
    issues.push({
      kind: 'wall-overflow',
      message: `${where}：落点偏移 ${offset}mm 越出墙起点（不能小于 0）`,
    });
  }

  // 落点 + 宽度不能越过墙末端
  if (offset >= 0 && width > 0) {
    const hSum = offset + width;
    const wallLen = Math.round(wall.lengthMm);
    if (hSum > wallLen) {
      issues.push({
        kind: 'wall-overflow',
        message: `${where}：落点 ${offset}mm + 宽度 ${width}mm = ${hSum}mm，超出墙长 ${wallLen}mm（超出 ${hSum - wallLen}mm）`,
      });
    }
  }

  // 离地高度 + 高度不能越过层高
  if (sill >= 0 && height > 0) {
    const vSum = sill + height;
    if (vSum > room.heightMm) {
      issues.push({
        kind: 'height-overflow',
        message: `${where}：离地高度 ${sill}mm + 高度 ${height}mm = ${vSum}mm，超出层高 ${room.heightMm}mm（超出 ${vSum - room.heightMm}mm）`,
      });
    }
  }

  // 同一面墙上的洞口不许互相压着
  if (width > 0) {
    const start = offset;
    const end = offset + width;
    for (const other of existing) {
      if (other.id === excludeId) continue;
      if (other.roomId !== candidate.roomId || other.wallIndex !== wallIdx) continue;
      const oStart = other.offsetMm;
      const oEnd = other.offsetMm + other.widthMm;
      const overlap = Math.min(end, oEnd) - Math.max(start, oStart);
      if (overlap > 0) {
        issues.push({
          kind: 'overlap',
          message: `${where}：与 ${openingLabel(other)} 重叠 ${overlap}mm`,
        });
      }
    }
  }

  return issues;
}

/**
 * 一次扫出方案里所有越界/互相压着的存量洞口，
 * 交给用户自己决定挪位置还是删掉。
 */
export function scanOpenings(rooms: Room[], openings: Opening[]): OpeningProblem[] {
  const problems: OpeningProblem[] = [];
  for (const op of openings) {
    const room = rooms.find((r) => r.id === op.roomId);
    if (!room) {
      problems.push({
        opening: op,
        issues: [{ kind: 'no-such-room', message: '所属房间已被删除，洞口悬空' }],
      });
      continue;
    }
    const issues = validateOpening(room, openings, op, op.id);
    if (issues.length > 0) {
      problems.push({ opening: op, roomName: room.name, issues });
    }
  }
  return problems;
}
