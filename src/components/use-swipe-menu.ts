"use client";
import { useRef, type PointerEvent, type MouseEvent } from "react";
import { swipeMenuDirection } from "@/lib/swipe";
export function useSwipeMenu(
  open: boolean,
  enabled: boolean,
  setOpen: (value: boolean) => void,
) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressedUntil = useRef(0);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.isPrimary) suppressedUntil.current = 0;
      if (
        !enabled ||
        e.pointerType !== "touch" ||
        !e.isPrimary ||
        window.innerWidth > 650
      )
        return;
      const target = e.target as HTMLElement;
      if (
        target.closest("input,textarea,select,dialog,[contenteditable=true]") ||
        (!open && target.closest("button,a,summary"))
      )
        return;
      if (!open && e.clientX > 40) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const point = start.current;
      start.current = null;
      if (!enabled || !point || point.id !== e.pointerId) return;
      const action = swipeMenuDirection(
        point,
        { x: e.clientX, y: e.clientY },
        open,
      );
      if (action) {
        suppressedUntil.current = Date.now() + 350;
        setOpen(action === "open");
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onClickCapture: (e: MouseEvent<HTMLElement>) => {
      if (Date.now() < suppressedUntil.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
