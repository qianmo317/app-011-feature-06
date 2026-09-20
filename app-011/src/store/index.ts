import { create } from 'zustand';
import type { Plan, Room, Opening, Outlet, MatSpec } from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';
import { checkOpening, toOpeningShape } from '../utils/openingValidation';

interface AddOpeningResult {
  ok: boolean;
  messages: string[];
}

interface AppState {
  plans: Plan[];
  currentPlanId: string | null;
  scale: number;
  setScale: (s: number) => void;
  addPlan: (name: string) => string;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => Plan | undefined;
  updatePlan: (id: string, updater: (plan: Plan) => Plan) => void;
  addRoom: (planId: string, room: Room) => void;
  updateRoom: (planId: string, roomId: string, updater: (room: Room) => Room) => void;
  deleteRoom: (planId: string, roomId: string) => void;
  /** 收下洞口前先过规则，越界 / 重叠一律不写入，返回原因 */
  addOpening: (planId: string, opening: Opening) => AddOpeningResult;
  updateOpening: (planId: string, openingId: string, updater: (o: Opening) => Opening) => AddOpeningResult;
  deleteOpening: (planId: string, openingId: string) => void;
  addOutlet: (planId: string, outlet: Outlet) => void;
  deleteOutlet: (planId: string, outletId: string) => void;
  updateMaterials: (planId: string, mats: MatSpec[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 最后一道防线：store 自己也验一遍，任何一层 UI 绕过都不会把越界洞口写进方案 */
function guardOpening(plan: Plan, next: Opening, excludeId?: string): AddOpeningResult {
  const issues = checkOpening(toOpeningShape(next), plan.rooms, plan.openings.map(toOpeningShape), excludeId);
  return { ok: issues.length === 0, messages: issues.map((i) => i.message) };
}

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  currentPlanId: null,
  scale: 1,

  setScale: (s) => set({ scale: s }),

  addPlan: (name) => {
    const id = genId();
    const plan: Plan = {
      id,
      name,
      createdAt: Date.now(),
      rooms: [],
      openings: [],
      outlets: [],
      materials: [...DEFAULT_MATS],
    };
    set((state) => ({ plans: [...state.plans, plan], currentPlanId: id }));
    return id;
  },

  deletePlan: (id) =>
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
      currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
    })),

  getPlan: (id) => get().plans.find((p) => p.id === id),

  updatePlan: (id, updater) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === id ? updater(p) : p)),
    })),

  addRoom: (planId, room) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, rooms: [...p.rooms, room] } : p
      ),
    })),

  updateRoom: (planId, roomId, updater) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? updater(r) : r)) }
          : p
      ),
    })),

  deleteRoom: (planId, roomId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              rooms: p.rooms.filter((r) => r.id !== roomId),
              openings: p.openings.filter((o) => o.roomId !== roomId),
            }
          : p
      ),
    })),

  addOpening: (planId, opening) => {
    let result: AddOpeningResult = { ok: true, messages: [] };
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        result = guardOpening(p, opening);
        return result.ok ? { ...p, openings: [...p.openings, opening] } : p;
      }),
    }));
    return result;
  },

  updateOpening: (planId, openingId, updater) => {
    let result: AddOpeningResult = { ok: true, messages: [] };
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        const old = p.openings.find((o) => o.id === openingId);
        if (!old) return p;
        const next = { ...updater(old), id: openingId };
        result = guardOpening(p, next, openingId);
        return result.ok
          ? { ...p, openings: p.openings.map((o) => (o.id === openingId ? next : o)) }
          : p;
      }),
    }));
    return result;
  },

  deleteOpening: (planId, openingId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, openings: p.openings.filter((o) => o.id !== openingId) }
          : p
      ),
    })),

  addOutlet: (planId, outlet) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, outlets: [...p.outlets, outlet] } : p
      ),
    })),

  deleteOutlet: (planId, outletId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, outlets: p.outlets.filter((o) => o.id !== outletId) }
          : p
      ),
    })),

  updateMaterials: (planId, mats) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, materials: mats } : p)),
    })),
}));
