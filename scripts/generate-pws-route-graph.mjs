import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PWS_ROUTE_SAMPLE_KM = 0.22;
const PWS_GRID_LAT_STEP = 0.016;
const PWS_GRID_LNG_STEP = 0.032;

const PWS_WATER_ROUTE_NODES = [
  { id: 'open-sw', lat: 59.34, lng: -148.72 },
  { id: 'open-south', lat: 59.42, lng: -147.78 },
  { id: 'open-central', lat: 59.42, lng: -146.62 },
  { id: 'open-se', lat: 59.58, lng: -145.45 },
  { id: 'montague-west', lat: 59.72, lng: -148.35 },
  { id: 'montague-northwest', lat: 59.95, lng: -148.16 },
  { id: 'latouche-pass', lat: 60.10, lng: -148.05 },
  { id: 'chenega-pass', lat: 60.24, lng: -147.96 },
  { id: 'knight-west', lat: 60.38, lng: -148.06 },
  { id: 'main-bay-mouth', lat: 60.52, lng: -148.00 },
  { id: 'northwest-sound', lat: 60.66, lng: -147.94 },
  { id: 'college-entrance', lat: 60.79, lng: -147.79 },
  { id: 'central-sound', lat: 60.42, lng: -147.28 },
  { id: 'naked-island-west', lat: 60.56, lng: -147.25 },
  { id: 'naked-island-north', lat: 60.70, lng: -147.17 },
  { id: 'columbia-mouth', lat: 60.84, lng: -147.06 },
  { id: 'valdez-arm-mouth', lat: 60.79, lng: -146.78 },
  { id: 'valdez-arm-south', lat: 60.91, lng: -146.75 },
  { id: 'valdez-arm-mid', lat: 61.00, lng: -146.61 },
  { id: 'valdez-narrows', lat: 61.08, lng: -146.48 },
  { id: 'port-valdez', lat: 61.12, lng: -146.36 },
  { id: 'tatitlek', lat: 60.77, lng: -146.40 },
  { id: 'bligh', lat: 60.67, lng: -146.25 },
  { id: 'hinchinbrook-north', lat: 60.40, lng: -146.28 },
  { id: 'hinchinbrook-entrance', lat: 60.22, lng: -146.58 },
  { id: 'copper-west', lat: 60.50, lng: -145.90 },
  { id: 'cordova-orca', lat: 60.62, lng: -145.70 },
];

const PWS_ROUTE_EDGES = [
  ['open-sw', 'open-south'],
  ['open-south', 'open-central'],
  ['open-central', 'open-se'],
  ['open-sw', 'montague-west'],
  ['open-south', 'montague-west'],
  ['open-south', 'hinchinbrook-entrance'],
  ['open-central', 'hinchinbrook-entrance'],
  ['open-central', 'hinchinbrook-north'],
  ['open-se', 'copper-west'],
  ['montague-west', 'montague-northwest'],
  ['montague-northwest', 'latouche-pass'],
  ['latouche-pass', 'chenega-pass'],
  ['chenega-pass', 'knight-west'],
  ['knight-west', 'main-bay-mouth'],
  ['main-bay-mouth', 'northwest-sound'],
  ['northwest-sound', 'college-entrance'],
  ['chenega-pass', 'central-sound'],
  ['central-sound', 'naked-island-west'],
  ['naked-island-west', 'naked-island-north'],
  ['naked-island-north', 'columbia-mouth'],
  ['columbia-mouth', 'valdez-arm-mouth'],
  ['valdez-arm-mouth', 'valdez-arm-south'],
  ['valdez-arm-south', 'valdez-arm-mid'],
  ['valdez-arm-mid', 'valdez-narrows'],
  ['valdez-narrows', 'port-valdez'],
  ['valdez-arm-mouth', 'tatitlek'],
  ['tatitlek', 'bligh'],
  ['bligh', 'hinchinbrook-north'],
  ['hinchinbrook-north', 'hinchinbrook-entrance'],
  ['hinchinbrook-north', 'copper-west'],
  ['copper-west', 'cordova-orca'],
  ['central-sound', 'hinchinbrook-entrance'],
];

function emptyBounds() {
  return {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
  };
}

function extendBounds(bounds, point) {
  bounds.minLat = Math.min(bounds.minLat, point.lat);
  bounds.maxLat = Math.max(bounds.maxLat, point.lat);
  bounds.minLng = Math.min(bounds.minLng, point.lng);
  bounds.maxLng = Math.max(bounds.maxLng, point.lng);
}

function pointWithinBounds(point, bounds, pad = 0) {
  return point.lat >= bounds.minLat - pad &&
    point.lat <= bounds.maxLat + pad &&
    point.lng >= bounds.minLng - pad &&
    point.lng <= bounds.maxLng + pad;
}

function boundaryRingFromGeoJson(rawRing) {
  const points = rawRing
    .map(([lng, lat]) => ({ lat, lng }))
    .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (points.length < 4) return null;

  const ringBounds = emptyBounds();
  for (const point of points) extendBounds(ringBounds, point);
  return { points, bounds: ringBounds };
}

function addBoundaryPolygon(rawRings, polygons, rings, globalBounds) {
  const polygonRings = [];
  const polygonBounds = emptyBounds();

  for (const rawRing of rawRings) {
    const ring = boundaryRingFromGeoJson(rawRing);
    if (!ring) continue;
    polygonRings.push(ring);
    rings.push(ring);
    for (const point of ring.points) {
      extendBounds(polygonBounds, point);
      extendBounds(globalBounds, point);
    }
  }

  if (polygonRings.length > 0 && Number.isFinite(polygonBounds.minLat)) {
    polygons.push({ rings: polygonRings, bounds: polygonBounds });
  }
}

function parseBoundary(collection) {
  const polygons = [];
  const rings = [];
  const bounds = emptyBounds();

  for (const feature of collection.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'Polygon') {
      addBoundaryPolygon(geometry.coordinates, polygons, rings, bounds);
    } else {
      for (const polygon of geometry.coordinates) addBoundaryPolygon(polygon, polygons, rings, bounds);
    }
  }

  return { polygons, rings, bounds, southernOpenLat: bounds.minLat + 0.02 };
}

function pointInRing(point, ring) {
  if (!pointWithinBounds(point, ring.bounds)) return false;
  let inside = false;
  const { points } = ring;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const current = points[i];
    const previous = points[j];
    const intersects = (current.lat > point.lat) !== (previous.lat > point.lat) &&
      point.lng < (previous.lng - current.lng) * (point.lat - current.lat) /
      ((previous.lat - current.lat) || Number.EPSILON) + current.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInBoundary(point, boundary) {
  if (!pointWithinBounds(point, boundary.bounds, 0.001)) return false;
  for (const polygon of boundary.polygons) {
    if (!pointWithinBounds(point, polygon.bounds)) continue;
    const [outerRing, ...holeRings] = polygon.rings;
    if (!outerRing || !pointInRing(point, outerRing)) continue;
    if (holeRings.some(ring => pointInRing(point, ring))) continue;
    return true;
  }
  return false;
}

const allowedPointCache = new Map();
function pointKey(point) {
  return `${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;
}

function isAllowedPwsWaterPoint(point, boundary) {
  if (point.lat <= boundary.southernOpenLat) return true;
  if (!pointWithinBounds(point, boundary.bounds, 0.03)) return false;
  const key = pointKey(point);
  const cached = allowedPointCache.get(key);
  if (cached !== undefined) return cached;
  const allowed = pointInBoundary(point, boundary);
  allowedPointCache.set(key, allowed);
  return allowed;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = value => value * Math.PI / 180;
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolatePoint(from, to, progress) {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress,
  };
}

function segmentAllowedByBoundary(from, to, boundary) {
  const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
  const samples = Math.max(3, Math.ceil(dist / PWS_ROUTE_SAMPLE_KM));
  for (let i = 0; i <= samples; i++) {
    if (!isAllowedPwsWaterPoint(interpolatePoint(from, to, i / samples), boundary)) return false;
  }
  return true;
}

function segmentBoundsIntersect(a, b) {
  return a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat &&
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng;
}

function pointOnSegment(point, a, b) {
  const cross = (point.lng - a.lng) * (b.lat - a.lat) - (point.lat - a.lat) * (b.lng - a.lng);
  if (Math.abs(cross) > 1e-10) return false;
  return point.lat >= Math.min(a.lat, b.lat) - 1e-10 &&
    point.lat <= Math.max(a.lat, b.lat) + 1e-10 &&
    point.lng >= Math.min(a.lng, b.lng) - 1e-10 &&
    point.lng <= Math.max(a.lng, b.lng) + 1e-10;
}

function orientation(a, b, c) {
  const value = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  if (Math.abs(value) < 1e-10) return 0;
  return value > 0 ? 1 : -1;
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnSegment(b, c, d)) return true;
  return false;
}

function segmentIntersectionProgress(a, b, c, d) {
  const rx = b.lng - a.lng;
  const ry = b.lat - a.lat;
  const sx = d.lng - c.lng;
  const sy = d.lat - c.lat;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const qpx = c.lng - a.lng;
  const qpy = c.lat - a.lat;
  const progress = (qpx * sy - qpy * sx) / denom;
  return Number.isFinite(progress) ? progress : null;
}

function segmentCrossesHardBoundary(from, to, boundary) {
  if (from.lat <= boundary.southernOpenLat && to.lat <= boundary.southernOpenLat) return false;
  const segmentBounds = {
    minLat: Math.min(from.lat, to.lat),
    maxLat: Math.max(from.lat, to.lat),
    minLng: Math.min(from.lng, to.lng),
    maxLng: Math.max(from.lng, to.lng),
  };
  const dist = distanceKm(from.lat, from.lng, to.lat, to.lng);
  const probeProgress = Math.min(0.035, Math.max(0.0015, 0.12 / Math.max(dist, 0.5)));

  for (const ring of boundary.rings) {
    if (!segmentBoundsIntersect(segmentBounds, ring.bounds)) continue;
    const { points } = ring;
    for (let i = 0; i < points.length - 1; i++) {
      if (!segmentsIntersect(from, to, points[i], points[i + 1])) continue;
      const progress = segmentIntersectionProgress(from, to, points[i], points[i + 1]);
      if (progress == null || progress <= 0.0005 || progress >= 0.9995) continue;
      const before = interpolatePoint(from, to, Math.max(0, progress - probeProgress));
      const after = interpolatePoint(from, to, Math.min(1, progress + probeProgress));
      if (!isAllowedPwsWaterPoint(before, boundary) || !isAllowedPwsWaterPoint(after, boundary)) return true;
    }
  }
  return false;
}

function segmentAllowedStrict(from, to, boundary) {
  if (!segmentAllowedByBoundary(from, to, boundary)) return false;
  return !segmentCrossesHardBoundary(from, to, boundary);
}

function connectGraphEdge(graph, fromIndex, toIndex) {
  const from = graph.nodes[fromIndex];
  const to = graph.nodes[toIndex];
  const weight = Number(distanceKm(from.lat, from.lng, to.lat, to.lng).toFixed(4));
  graph.edges[fromIndex].push({ to: toIndex, weight });
  graph.edges[toIndex].push({ to: fromIndex, weight });
}

function nearestGraphNodes(point, graph, count, maxDistanceKm) {
  return graph.nodes
    .map((node, index) => ({
      index,
      distance: distanceKm(point.lat, point.lng, node.lat, node.lng),
    }))
    .filter(item => item.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

async function main() {
  const sourcePath = path.join(root, 'public', 'data', 'pws-districts.geojson');
  const outputPath = path.join(root, 'public', 'data', 'pws-route-graph.json');
  const collection = JSON.parse(await readFile(sourcePath, 'utf8'));
  const boundary = parseBoundary(collection);

  const nodes = [];
  const edges = [];
  const gridIndex = new Map();
  const routeNodeIndex = new Map();

  function addNode(node) {
    const index = nodes.length;
    nodes.push(node.id ? { id: node.id, lat: node.lat, lng: node.lng } : { lat: Number(node.lat.toFixed(6)), lng: Number(node.lng.toFixed(6)) });
    edges.push([]);
    if (node.id) routeNodeIndex.set(node.id, index);
    return index;
  }

  let row = 0;
  for (let lat = boundary.bounds.minLat; lat <= boundary.bounds.maxLat; lat += PWS_GRID_LAT_STEP, row++) {
    let col = 0;
    for (let lng = boundary.bounds.minLng; lng <= boundary.bounds.maxLng; lng += PWS_GRID_LNG_STEP, col++) {
      const point = { lat, lng };
      if (!isAllowedPwsWaterPoint(point, boundary)) continue;
      const index = addNode(point);
      gridIndex.set(`${row}:${col}`, index);
    }
  }

  for (const node of PWS_WATER_ROUTE_NODES) {
    if (!isAllowedPwsWaterPoint(node, boundary)) continue;
    addNode(node);
  }

  const graph = { nodes, edges };
  const neighborOffsets = [
    [1, 0], [0, 1], [1, 1], [1, -1],
    [2, 0], [0, 2], [2, 1], [1, 2], [2, -1], [1, -2],
    [2, 2], [2, -2],
  ];

  for (const [key, index] of gridIndex) {
    const [rowText, colText] = key.split(':');
    const r = Number(rowText);
    const c = Number(colText);
    for (const [dr, dc] of neighborOffsets) {
      const neighbor = gridIndex.get(`${r + dr}:${c + dc}`);
      if (neighbor == null) continue;
      if (!segmentAllowedByBoundary(nodes[index], nodes[neighbor], boundary)) continue;
      connectGraphEdge(graph, index, neighbor);
    }
  }

  for (const [fromId, toId] of PWS_ROUTE_EDGES) {
    const fromIndex = routeNodeIndex.get(fromId);
    const toIndex = routeNodeIndex.get(toId);
    if (fromIndex == null || toIndex == null) continue;
    if (!segmentAllowedStrict(nodes[fromIndex], nodes[toIndex], boundary)) continue;
    connectGraphEdge(graph, fromIndex, toIndex);
  }

  for (const routeIndex of routeNodeIndex.values()) {
    for (const candidate of nearestGraphNodes(nodes[routeIndex], graph, 10, 7)) {
      if (candidate.index === routeIndex) continue;
      if (!segmentAllowedStrict(nodes[routeIndex], nodes[candidate.index], boundary)) continue;
      connectGraphEdge(graph, routeIndex, candidate.index);
    }
  }

  await writeFile(outputPath, `${JSON.stringify(graph)}\n`);
  console.log(`Generated ${path.relative(root, outputPath)} with ${nodes.length} nodes.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
