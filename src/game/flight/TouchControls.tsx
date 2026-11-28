"use client";

/**
 * Phone controls: a joystick on the left (turn and throttle) and Up / Down / Boost buttons on the
 * right. Each control tracks its own finger, so the joystick and the buttons work at the same time.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { TouchState } from "./input";

type Props = {
  onChange: (patch: Partial<TouchState>) => void;
  labels: { up: string; down: string; boost: string; stick: string };
};

const STICK = 128; // px
const KNOB = 52;

export function TouchControls({ onChange, labels }: Props) {
  const base = useRef<HTMLDivElement>(null);
  const finger = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const moveStick = (e: ReactPointerEvent) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const radius = (STICK - KNOB) / 2;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      dx = (dx / d) * radius;
      dy = (dy / d) * radius;
    }
    setKnob({ x: dx, y: dy });
    onChange({ stickX: dx / radius, stickY: -dy / radius });
  };

  const release = () => {
    finger.current = null;
    setKnob({ x: 0, y: 0 });
    onChange({ stickX: 0, stickY: 0 });
  };

  return (
    <>
      <div
        ref={base}
        role="slider"
        aria-label={labels.stick}
        aria-valuenow={0}
        className="pointer-events-auto absolute bottom-5 left-5 rounded-full border-2 border-white/25 bg-white/10 backdrop-blur-sm"
        style={{ width: STICK, height: STICK }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (finger.current !== null) return;
          finger.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e);
        }}
        onPointerMove={(e) => {
          if (e.pointerId === finger.current) moveStick(e);
        }}
        onPointerUp={(e) => e.pointerId === finger.current && release()}
        onPointerCancel={(e) => e.pointerId === finger.current && release()}
        onLostPointerCapture={(e) => e.pointerId === finger.current && release()}
      >
        <div
          className="absolute rounded-full border-2 border-neon-cyan/80 bg-neon-cyan/30"
          style={{ width: KNOB, height: KNOB, left: (STICK - KNOB) / 2 - 2 + knob.x, top: (STICK - KNOB) / 2 - 2 + knob.y }}
        />
      </div>
      <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-end gap-2">
        <HoldButton label={labels.up} onHold={(v) => onChange({ up: v })} />
        <div className="flex gap-2">
          <HoldButton label={labels.boost} small onHold={(v) => onChange({ boost: v })} />
          <HoldButton label={labels.down} onHold={(v) => onChange({ down: v })} />
        </div>
      </div>
    </>
  );
}

function HoldButton({ label, onHold, small }: { label: string; onHold: (held: boolean) => void; small?: boolean }) {
  const [held, setHeld] = useState(false);
  const set = (v: boolean) => {
    setHeld(v);
    onHold(v);
  };
  return (
    <button
      type="button"
      aria-pressed={held}
      className={`select-none rounded-full border-2 font-display text-xs font-black uppercase tracking-wide backdrop-blur-sm ${
        held ? "border-neon-cyan bg-neon-cyan/35 text-white" : "border-white/30 bg-white/10 text-slate-100"
      } ${small ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem]"}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
