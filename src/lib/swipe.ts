export function swipeMenuDirection(
  start: { x: number; y: number },
  end: { x: number; y: number },
  open: boolean,
) {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.7) return null;
  if (open && dx < 0) return "close";
  if (!open && start.x <= 40 && dx > 0) return "open";
  return null;
}
