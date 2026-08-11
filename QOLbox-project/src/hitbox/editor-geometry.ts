export interface Bounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export function polygonContainsPoint(points: number[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
    const ax = points[previous] ?? 0;
    const ay = points[previous + 1] ?? 0;
    const bx = points[index] ?? 0;
    const by = points[index + 1] ?? 0;
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < 0.001 && (x - ax) * (x - bx) + (y - ay) * (y - by) <= 0) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function polygonsIntersect(left: number[], right: number[]): boolean {
  const vertices = (points: number[]) => Array.from({ length: points.length / 2 }, (_, index) => ({
    x: points[index * 2] ?? 0,
    y: points[index * 2 + 1] ?? 0,
  }));
  const leftVertices = vertices(left);
  const rightVertices = vertices(right);
  if (
    leftVertices.some(point => polygonContainsPoint(right, point.x, point.y)) ||
    rightVertices.some(point => polygonContainsPoint(left, point.x, point.y))
  ) return true;

  const edgesCross = (
    firstStart: { x: number; y: number },
    firstEnd: { x: number; y: number },
    secondStart: { x: number; y: number },
    secondEnd: { x: number; y: number },
  ) => {
    const firstX = firstEnd.x - firstStart.x;
    const firstY = firstEnd.y - firstStart.y;
    const secondX = secondEnd.x - secondStart.x;
    const secondY = secondEnd.y - secondStart.y;
    const denominator = firstX * secondY - firstY * secondX;
    if (Math.abs(denominator) < 1e-6) return false;
    const offsetX = secondStart.x - firstStart.x;
    const offsetY = secondStart.y - firstStart.y;
    const firstDistance = (offsetX * secondY - offsetY * secondX) / denominator;
    const secondDistance = (offsetX * firstY - offsetY * firstX) / denominator;
    return firstDistance >= 0 && firstDistance <= 1 && secondDistance >= 0 && secondDistance <= 1;
  };
  return leftVertices.some((start, index) => {
    const end = leftVertices[(index + 1) % leftVertices.length]!;
    return rightVertices.some((otherStart, otherIndex) =>
      edgesCross(start, end, otherStart, rightVertices[(otherIndex + 1) % rightVertices.length]!)
    );
  });
}

export function offsetPolygon(points: number[], distance: number): number[] {
  const vertices = Array.from({ length: points.length / 2 }, (_, index) => ({
    x: points[index * 2] ?? 0,
    y: points[index * 2 + 1] ?? 0,
  }));
  if (vertices.length < 3) return [];
  const area = vertices.reduce((sum, point, index) => {
    const next = vertices[(index + 1) % vertices.length]!;
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-6) return [];
  const normal = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const x = to.x - from.x;
    const y = to.y - from.y;
    const length = Math.hypot(x, y);
    if (!length) return null;
    return area > 0 ? { x: y / length, y: -x / length } : { x: -y / length, y: x / length };
  };
  return vertices.flatMap((point, index) => {
    const previous = vertices[(index + vertices.length - 1) % vertices.length]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const previousNormal = normal(previous, point);
    const nextNormal = normal(point, next);
    if (!previousNormal || !nextNormal) return [point.x, point.y];
    const previousDirection = { x: point.x - previous.x, y: point.y - previous.y };
    const nextDirection = { x: next.x - point.x, y: next.y - point.y };
    const first = { x: point.x + previousNormal.x * distance, y: point.y + previousNormal.y * distance };
    const second = { x: point.x + nextNormal.x * distance, y: point.y + nextNormal.y * distance };
    const denominator = previousDirection.x * nextDirection.y - previousDirection.y * nextDirection.x;
    if (Math.abs(denominator) > 1e-6) {
      const t = ((second.x - first.x) * nextDirection.y - (second.y - first.y) * nextDirection.x) / denominator;
      const intersection = { x: first.x + previousDirection.x * t, y: first.y + previousDirection.y * t };
      if (Math.hypot(intersection.x - point.x, intersection.y - point.y) <= distance * 8) {
        return [intersection.x, intersection.y];
      }
    }
    const sum = { x: previousNormal.x + nextNormal.x, y: previousNormal.y + nextNormal.y };
    const length = Math.hypot(sum.x, sum.y) || 1;
    return [point.x + sum.x / length * distance, point.y + sum.y / length * distance];
  });
}

export function rotatePoint(point: { x: number; y: number }, angle: number): { x: number; y: number } {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
}

export function getPointBounds(points: Array<{ x: number; y: number }>): Bounds | null {
  if (!points.length) return null;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { height: Math.max(...ys) - y, width: Math.max(...xs) - x, x, y };
}

export function getArea(start: { x: number; y: number }, end: { x: number; y: number }): Bounds {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

export function areasIntersect(left: Bounds, right: Bounds): boolean {
  return left.x <= right.x + right.width && left.x + left.width >= right.x &&
    left.y <= right.y + right.height && left.y + left.height >= right.y;
}

export function distanceToPolygon(points: number[], point: { x: number; y: number }): number {
  let distance = Infinity;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    const ax = points[index] ?? 0;
    const ay = points[index + 1] ?? 0;
    const bx = points[next] ?? 0;
    const by = points[next + 1] ?? 0;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared)) : 0;
    distance = Math.min(distance, Math.hypot(point.x - ax - dx * t, point.y - ay - dy * t));
  }
  return distance;
}
