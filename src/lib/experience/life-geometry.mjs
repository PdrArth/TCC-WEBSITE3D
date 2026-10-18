/** Pure, deterministic v20 house/islet/bridge geometry. No React or browser state. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { homeLocalPoint, pathLength, sampleLifePath } from "./island-life.mjs";
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export const LIFE_GEOMETRY_SCHEMA_VERSION = 1;
export const LIFE_GEOMETRY_VERSION = 20;
const STATIC_KINDS = ["oak", "rail", "plaster", "roof", "window", "stone", "snow", "grass", "foliage"];
const ARRAY_TYPES = { Float32Array, Uint16Array, Uint32Array };

/** Layout-only fingerprint: the walking graph and resident state never affect
 * static geometry. Bump the recipe when the geometry construction changes. */
export function lifeGeometrySignature(layout) {
    const input = JSON.stringify({ recipe: "island-life-v20.2-bed", islet: layout.islet, home: layout.home,
        bridge: { points: layout.bridge.points, width: layout.bridge.width }, connector: layout.connector, landings: layout.landings });
    let hash = 2166136261;
    for (let index = 0; index < input.length; index++) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
    return `life20-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function encodeBytes(array) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    if (typeof bytes.toBase64 === "function") return bytes.toBase64();
    if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
}

function encodeAttribute(attribute) {
    return { arrayType: attribute.array.constructor.name, itemSize: attribute.itemSize, count: attribute.count,
        normalized: attribute.normalized, data: encodeBytes(attribute.array) };
}

function decodeAttribute(encoded, index = false) {
    if (!encoded || typeof encoded.data !== "string" || !Number.isInteger(encoded.count) || encoded.count <= 0 || !Number.isInteger(encoded.itemSize)) throw new Error("Invalid prepared life attribute");
    const Constructor = ARRAY_TYPES[encoded.arrayType];
    if (!Constructor || (index ? ![Uint16Array, Uint32Array].includes(Constructor) || encoded.itemSize !== 1 : Constructor !== Float32Array)) throw new Error("Unsupported prepared life array type");
    let bytes;
    if (typeof Uint8Array.fromBase64 === "function") bytes = Uint8Array.fromBase64(encoded.data);
    else if (typeof Buffer !== "undefined") bytes = Buffer.from(encoded.data, "base64");
    else {
        const binary = atob(encoded.data); bytes = new Uint8Array(binary.length);
        for (let offset = 0; offset < binary.length; offset++) bytes[offset] = binary.charCodeAt(offset);
    }
    if (bytes.byteLength !== encoded.count * encoded.itemSize * Constructor.BYTES_PER_ELEMENT) throw new Error("Prepared life array length mismatch");
    if (bytes.byteOffset % Constructor.BYTES_PER_ELEMENT) bytes = Uint8Array.from(bytes);
    return new THREE.BufferAttribute(new Constructor(bytes.buffer, bytes.byteOffset, bytes.byteLength / Constructor.BYTES_PER_ELEMENT), encoded.itemSize, !!encoded.normalized);
}

/** Offline preparation preserves the exact Float32 and index bytes. The asset
 * needs only JSON parsing/base64 decode at runtime, with no primitive creation,
 * vertex transforms, merges, normals or bounds calculation. */
export function prepareLifeGeometry(layout) {
    const batches = createLifeGeometry(layout);
    try {
        return { schemaVersion: LIFE_GEOMETRY_SCHEMA_VERSION, version: LIFE_GEOMETRY_VERSION, signature: lifeGeometrySignature(layout),
            batches: batches.map(({ kind, geometry }) => ({ kind,
                attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, encodeAttribute(attribute)])),
                index: encodeAttribute(geometry.index),
                bounds: { sphere: { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } } })) };
    } finally { for (const batch of batches) batch.geometry.dispose(); }
}

/** Returns null for absent, outdated or malformed assets, allowing the renderer
 * to use the same pure generator. Each call owns its geometries and array views. */
export function restoreLifeGeometry(prepared, layout) {
    if (!prepared || prepared.schemaVersion !== LIFE_GEOMETRY_SCHEMA_VERSION || prepared.version !== LIFE_GEOMETRY_VERSION || prepared.signature !== lifeGeometrySignature(layout) || !Array.isArray(prepared.batches) || prepared.batches.length !== STATIC_KINDS.length) return null;
    const batches = [], geometries = [];
    try {
        for (const [index, batch] of prepared.batches.entries()) {
            if (batch.kind !== STATIC_KINDS[index]) throw new Error("Invalid prepared life batch");
            const geometry = new THREE.BufferGeometry(); geometries.push(geometry);
            for (const [name, size] of [["position", 3], ["normal", 3], ["uv", 2], ["color", 3]]) {
                const attribute = decodeAttribute(batch.attributes?.[name]);
                if (attribute.itemSize !== size || (name !== "position" && attribute.count !== geometry.attributes.position.count)) throw new Error("Invalid prepared life vertex layout");
                geometry.setAttribute(name, attribute);
            }
            const indices = decodeAttribute(batch.index, true);
            if (indices.count % 3) throw new Error("Invalid prepared life triangles");
            geometry.setIndex(indices);
            const sphere = batch.bounds?.sphere;
            if (!sphere || !Array.isArray(sphere.center) || sphere.center.length !== 3 || !sphere.center.every(Number.isFinite) || !Number.isFinite(sphere.radius) || sphere.radius < 0) throw new Error("Invalid prepared life bounds");
            geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...sphere.center), sphere.radius);
            geometry.userData.preparedLife = true;
            batches.push({ kind: batch.kind, geometry });
        }
        return batches;
    } catch {
        for (const geometry of geometries) geometry.dispose();
        return null;
    }
}

export function segment(a, b, radius, sides = 8) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), sides);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize()));
    geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return geometry;
}
export function tintGeometry(geometry, tint = 1) {
    const count = geometry.getAttribute("position").count, values = new Float32Array(count * 3);
    values.fill(tint);
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    return geometry;
}
export function mergePieces(pieces) {
    const merged = mergeGeometries(pieces, false);
    for (const piece of pieces)
        piece.dispose();
    merged.computeBoundingSphere();
    return merged;
}
export function createCaughtFishGeometry() {
    const body = new THREE.SphereGeometry(1, 10, 7); body.scale(.095, .062, .24);
    const tail = new THREE.BufferGeometry(); tail.setAttribute("position", new THREE.Float32BufferAttribute([0,0,-.18,-.11,0,-.39,.11,0,-.39], 3));
    tail.setIndex([0,1,2]); tail.setAttribute("uv", new THREE.Float32BufferAttribute([.5,1,0,0,1,0], 2)); tail.computeVertexNormals();
    const pieces = [tintGeometry(body), tintGeometry(tail, .82)];
    for (const side of [-1, 1]) { const eye = new THREE.SphereGeometry(.011, 5, 4); eye.translate(side * .071, .028, .15); pieces.push(tintGeometry(eye, .15)); }
    return mergePieces(pieces);
}
function isletGeometry(layout, surface) {
    const { center, radius, height } = layout.islet, count = 40;
    const positions = [], indices = [];
    const outline = (index) => {
        const angle = index * Math.PI * 2 / count;
        const r = radius * (1 + .026 * Math.sin(angle * 3 + .6) + .019 * Math.cos(angle * 7));
        return [Math.cos(angle) * r, Math.sin(angle) * r];
    };
    if (surface) {
        positions.push(center[0], height, center[1]);
        for (let index = 0; index < count; index++) {
            const [x, z] = outline(index);
            positions.push(center[0] + x, height - .012, center[1] + z);
            indices.push(0, (index + 1) % count + 1, index + 1);
        }
    }
    else {
        for (const ring of [0, 1])
            for (let index = 0; index < count; index++) {
                const [x, z] = outline(index), scale = ring ? .90 : 1.025;
                positions.push(center[0] + x * scale, ring ? -.46 + .025 * Math.sin(index * 2) : height - .033, center[1] + z * scale);
            }
        for (let index = 0; index < count; index++) {
            const next = (index + 1) % count;
            indices.push(index, next, index + count, next, next + count, index + count);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}
export function createLifeGeometry(layout) {
    const pieces = { oak: [], rail: [], plaster: [], roof: [], window: [], stone: [], snow: [], grass: [], foliage: [] };
    const add = (kind, geometry, tint = 1) => pieces[kind].push(tintGeometry(geometry, tint));
    const box = (kind, position, dimensions, rotateY = 0, rotateZ = 0, tint = 1) => {
        const geometry = new THREE.BoxGeometry(...dimensions);
        geometry.rotateZ(rotateZ);
        geometry.rotateY(rotateY);
        geometry.translate(...position);
        add(kind, geometry, tint);
    };
    const oval = (kind, position, size, yaw = 0, tint = 1) => {
        const geometry = new THREE.SphereGeometry(1, 8, 5);
        geometry.scale(...size);
        geometry.rotateY(yaw);
        geometry.translate(...position);
        add(kind, geometry, tint);
    };
    const bridge = (points, width, junction) => {
        const length = pathLength(points), count = Math.ceil(length / .19), middle = length / 2;
        const at = (metres) => sampleLifePath(points, metres);
        for (let index = 0; index <= count; index++) {
            const point = at(length * index / count), before = at(Math.max(0, length * index / count - .035)), after = at(Math.min(length, length * index / count + .035));
            box("oak", point, [width, .10, length / count * .93], Math.atan2(after[0] - before[0], after[2] - before[2]), 0, index % 4 === 0 ? .91 : 1);
        }
        for (const side of [-1, 1]) {
            // Leave a physical opening in the inside rail where the connector joins.
            const spans = junction && side === -1 ? [[0, middle - .73], [middle + .73, length]] : [[0, junction ? length : length - width / 2]];
            for (const [start, end] of spans) {
                const posts = Math.max(1, Math.ceil((end - start) / 1.25)), upper = [], lower = [];
                for (let index = 0; index <= posts; index++) {
                    const metres = start + (end - start) * index / posts, point = at(metres), before = at(Math.max(0, metres - .05)), after = at(Math.min(length, metres + .05));
                    const dx = after[0] - before[0], dz = after[2] - before[2], norm = Math.hypot(dx, dz) || 1;
                    const x = point[0] + dz / norm * (width / 2 + .015) * side, z = point[2] - dx / norm * (width / 2 + .015) * side;
                    add("rail", segment([x, point[1] - .055, z], [x, point[1] + .74, z], .028));
                    upper.push([x, point[1] + .74, z]);
                    lower.push([x, point[1] + .33, z]);
                    if (index % 3 === 1)
                        add("rail", segment([x, -.60, z], [x, point[1] + .08, z], .055));
                }
                for (let index = 1; index < upper.length; index++) {
                    add("oak", segment(upper[index - 1], upper[index], .034));
                    add("rail", segment(lower[index - 1], lower[index], .019));
                }
            }
        }
    };
    bridge(layout.bridge.points, layout.bridge.width, true);
    bridge(layout.connector.points, layout.connector.width, false);
    for (const landing of layout.landings) {
        const length = pathLength(landing.points), count = Math.max(1, Math.ceil(length / .16));
        for (let index = 0; index <= count; index++) {
            const p = sampleLifePath(landing.points, length * index / count), a = landing.points[0], b = landing.points[landing.points.length - 1];
            box("oak", p, [landing.width, .10, length / count + .025], Math.atan2(b[0] - a[0], b[2] - a[2]));
        }
    }
    for (const t of [.28, .72]) {
        const point = sampleLifePath(layout.connector.points, pathLength(layout.connector.points) * t);
        add("rail", segment([point[0], -.62, point[2]], [point[0], point[1] - .04, point[2]], .09));
    }
    add("grass", isletGeometry(layout, true));
    add("stone", isletGeometry(layout, false), .91);
    const { center, radius, height } = layout.islet;
    for (let index = 0; index < 27; index++) {
        const angle = index * Math.PI * 2 / 27, r = radius * (1 + .025 * Math.sin(angle * 3 + .6));
        if (Math.abs(Math.cos(angle)) < .25 && Math.sin(angle) > 0)
            continue;
        oval("stone", [center[0] + Math.cos(angle) * r, height - .025, center[1] + Math.sin(angle) * r], [.20 + index % 3 * .035, .095, .15], angle, .88 + index % 4 * .055);
    }
    for (const [x, z] of [[-2.56, -.70], [2.57, -.25], [-2.32, 1.14], [2.37, 1.32]]) {
        for (let leaf = 0; leaf < 5; leaf++) {
            const angle = leaf * Math.PI * 2 / 5;
            oval("foliage", [center[0] + x + Math.cos(angle) * .09, height + .10 + leaf % 2 * .025, center[1] + z + Math.sin(angle) * .09], [.07, .085, .22], angle, .88 + leaf * .025);
        }
    }
    const { home } = layout, [width, depth] = home.footprint, floor = home.floorHeight, wall = home.wallHeight, eave = floor + wall;
    const houseBox = (kind, local, dimensions, rotateZ = 0, tint = 1) => box(kind, homeLocalPoint(home, local), dimensions, home.yaw, rotateZ, tint);
    const front = depth / 2 - .045, doorLeft = .20, doorRight = 1.10, windowLeft = -1.65, windowRight = -.25;
    houseBox("stone", [0, floor / 2, 0], [width + .04, floor, depth + .06]);
    houseBox("stone", [0, floor / 2, depth / 2 + home.porchDepth / 2], [home.porchWidth + .06, floor, home.porchDepth + .08]);
    houseBox("oak", [0, floor - .008, 0], [width - .08, .04, depth - .07], 0, .92);
    for (let index = 0; index < 11; index++)
        houseBox("oak", [0, floor - .008, depth / 2 + (index + .5) * home.porchDepth / 11], [home.porchWidth, .04, home.porchDepth / 11 * .94], 0, index % 3 ? 1 : .92);
    for (const side of [-1, 1])
        houseBox("plaster", [side * (width / 2 - .045), floor + wall / 2, 0], [.09, wall, depth]);
    houseBox("plaster", [0, floor + wall / 2, -depth / 2 + .045], [width, wall, .09]);
    const wallPanel = (left, right, bottom, top) => houseBox("plaster", [(left + right) / 2, floor + (bottom + top) / 2, front], [right - left, top - bottom, .09]);
    wallPanel(-width / 2, windowLeft, 0, wall);
    wallPanel(windowRight, doorLeft, 0, wall);
    wallPanel(doorRight, width / 2, 0, wall);
    wallPanel(windowLeft, windowRight, 0, .76);
    wallPanel(windowLeft, windowRight, 1.90, wall);
    wallPanel(doorLeft, doorRight, 1.94, wall);
    const gable = (z) => {
        const half = width / 2, top = eave + home.roofRise, d = .045, geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute([-half, eave, z + d, 0, top, z + d, half, eave, z + d, -half, eave, z - d, 0, top, z - d, half, eave, z - d], 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(12), 2));
        geometry.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 0, 3, 5, 0, 5, 2]);
        geometry.computeVertexNormals();
        geometry.rotateY(home.yaw);
        geometry.translate(...home.position);
        add("plaster", geometry);
    };
    gable(front);
    gable(-depth / 2 + .045);
    for (const x of [doorLeft - .025, doorRight + .025])
        houseBox("oak", [x, floor + .98, depth / 2 + .018], [.065, 1.99, .12]);
    houseBox("oak", [.65, floor + 1.965, depth / 2 + .018], [1.015, .07, .12]);
    houseBox("stone", [.65, floor + .018, depth / 2 + .02], [.99, .036, .22]);
    for (const x of [windowLeft - .025, windowRight + .025])
        houseBox("oak", [x, floor + 1.33, depth / 2 + .018], [.065, 1.23, .12]);
    for (const y of [.735, 1.925])
        houseBox("oak", [-.95, floor + y, depth / 2 + .024], [1.51, .065, .14]);
    houseBox("oak", [-.95, floor + .70, depth / 2 + .11], [1.59, .075, .29]);
    houseBox("window", [-.95, floor + 1.33, depth / 2 + .008], [1.40, 1.12, .012]);
    for (const side of [-1, 1]) {
        houseBox("oak", [side * (home.porchWidth / 2 - .07), (floor + eave) / 2, depth / 2 + home.porchDepth - .08], [.095, eave - floor, .095]);
        houseBox("oak", [side * (width / 2 - .04), floor + .09, 0], [.13, .18, depth + .06], 0, .88);
    }
    houseBox("oak", [0, eave - .06, depth / 2 + home.porchDepth - .08], [home.porchWidth + .10, .13, .11]);
    const halfRoof = width / 2 + .19, roofFront = depth / 2 + home.porchDepth + .14, roofBack = -depth / 2 - .17, roofDepth = roofFront - roofBack;
    const slope = Math.atan2(home.roofRise, halfRoof), roofMiddle = (roofFront + roofBack) / 2;
    for (const side of [-1, 1]) {
        const centre = [side * halfRoof / 2, eave + home.roofRise / 2, roofMiddle], dimensions = [Math.hypot(halfRoof, home.roofRise), .095, roofDepth];
        houseBox("roof", centre, dimensions, -side * slope);
        houseBox("snow", [centre[0], centre[1] + .068, centre[2]], [dimensions[0], .028, dimensions[2]], -side * slope);
        for (let z = roofBack + .09; z <= roofFront; z += .245)
            add("roof", segment(homeLocalPoint(home, [0, eave + home.roofRise + .055, z]), homeLocalPoint(home, [side * halfRoof, eave + .055, z]), .038, 7), .97);
        houseBox("oak", [side * halfRoof, eave - .015, roofMiddle], [.075, .12, roofDepth], 0, .83);
    }
    add("roof", segment(homeLocalPoint(home, [0, eave + home.roofRise + .065, roofBack]), homeLocalPoint(home, [0, eave + home.roofRise + .065, roofFront]), .085, 9), 1.06);
    const bench = (position, seatWidth) => {
        const local = new THREE.Vector3(...position).sub(new THREE.Vector3(...home.position)).applyAxisAngle(Y_AXIS, -home.yaw);
        const x = local.x, z = local.z, seat = home.seatHeight;
        houseBox("oak", [x, floor + seat - .025, z], [seatWidth, .05, .43]);
        for (const side of [-1, 1])
            for (const end of [-1, 1])
                houseBox("rail", [x + side * (seatWidth / 2 - .10), floor + (seat - .05) / 2, z + end * .145], [.055, seat - .05, .055]);
        for (const side of [-1, 1])
            houseBox("rail", [x + side * (seatWidth / 2 - .07), floor + .62, z - .19], [.045, .65, .045]);
        for (const y of [.63, .81])
            houseBox("oak", [x, floor + y, z - .19], [seatWidth, .13, .045]);
    };
    bench(home.seated, home.bench.width);
    // The porch bench stays; a low oak bed replaces the indoor chair.
    houseBox("oak", [-.95, floor + .25, .02], [1.20, .14, 2.22]);
    for (const x of [-1.43, -.47]) for (const z of [-.92, .96]) houseBox("rail", [x, floor + .12, z], [.085, .24, .085]);
    houseBox("oak", [-.95, floor + .55, -1.06], [1.23, .64, .09]);
    houseBox("plaster", [-.95, floor + .38, .02], [1.12, .16, 2.16], 0, 1.04);
    houseBox("plaster", [-.95, floor + .49, -.52], [.79, .14, .45], 0, 1.09);
    houseBox("foliage", [-.95, floor + .48, .67], [1.13, .055, .69], 0, 1.23);
    houseBox("oak", [.98, floor + .63, -.50], [.80, .065, .57]);
    for (const side of [-1, 1])
        for (const end of [-1, 1])
            houseBox("rail", [.98 + side * .30, floor + .30, -.50 + end * .19], [.055, .60, .055]);
    houseBox("plaster", [1.1, floor + 1.35, -depth / 2 + .11], [.54, .40, .045], 0, .93);
    houseBox("oak", [.65, floor * .30, depth / 2 + home.porchDepth + .20], [1.10, floor * .60, .35]);
    for (let z = home.position[2] + depth / 2 + home.porchDepth + .37; z < layout.connector.points[0][2] - .10; z += .34)
        box("stone", [.15 * Math.sin(z * 3), height + .013, z], [.42, .035, .28], Math.sin(z * 4) * .16);
    return Object.entries(pieces).filter(([, geometries]) => geometries.length).map(([kind, geometries]) => ({ kind, geometry: mergePieces(geometries) }));
}
