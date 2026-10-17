"""Author v8: seven study pavilions in a living Brazilian miniature garden.

The pavilion meshes and their furniture are loaded intact from the retained v7
source. Everything surrounding them is new, true 3D geometry. Botanical forms
are illustrations inspired by Brazilian gardens, not scientific plant models.

blender --background --threads 4 --python scripts/world/build_world_v8.py
"""
from pathlib import Path
import ast, json, math, random, sys, hashlib
import bpy, bmesh
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/world"
OUT = ROOT / "public/experience/world"
TEX = SOURCE / "textures/derived"
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
IDS = ("pesquisa", "gerar", "comparar", "validar", "especificar", "evoluir", "perspectivas")
# Blender uses Z up; glTF uses Y up and negates Blender Y into glTF Z.
LAYOUT = [
    ("pesquisa", -11.0, -9.0), ("gerar", -14.0, 1.0),
    ("comparar", -10.0, 11.0), ("validar", 0.0, 14.0),
    ("especificar", 10.0, 11.0), ("evoluir", 14.0, 1.0),
    ("perspectivas", 11.0, -9.0),
]
RADII = {pid: 4.08 + (.14 if pid in ("pesquisa", "perspectivas") else 0) for pid in IDS}
R = random.Random(81173)
QUICK = False
WORLD = []
AMBIENT = []
OWNERSHIP = {}
TREE_RECORDS = []
BRIDGES = []
PERCHES = []

bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "archipelago-v7.blend"))
scene = bpy.context.scene
MATS = {mat.name: mat for mat in bpy.data.materials}
# Load only shared modelling functions. Executing the v6 entrypoint would reset
# the retained source scene and lose the approved furniture.
helper = Path(__file__).with_name("build_world.py")
tree = ast.parse(helper.read_text(encoding="utf-8"))
names = {"color", "material", "own", "assign", "apply_modifiers", "mesh", "cube", "cylinder", "segment", "sphere", "arc_wall", "annulus", "line", "text", "join", "rock"}
nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(helper), "exec"), globals())

kept = {"pavilion_" + pid for pid in IDS}
for obj in list(scene.objects):
    if obj.type == "MESH" and obj.name not in kept and obj.name != "Poster shadow ground":
        bpy.data.objects.remove(obj, do_unlink=True)
for pid, cx, cy in LAYOUT:
    obj = bpy.data.objects["pavilion_" + pid]
    obj.location = (cx, cy, 0)
    obj["v8_island"] = pid
    WORLD.append(obj)
    OWNERSHIP[obj.name] = pid

PALETTE = {
    "Garden olive dark": "467449", "Garden sage": "73965C",
    "Garden olive light": "9CAF68", "Garden leaf deep": "315A3F",
    "Garden dry tip": "C7B384", "Flower ivory": "FFF0CE", "Flower blue": "A3BBD7",
    "Flower ipe gold": "EFC553", "Flower quaresmeira": "AB85C4",
    "Flower ipe rose": "D8A5C5", "Flower coral": "DE9774",
    "Fruit pitanga": "C97742", "Fruit jabuticaba": "453C48",
    "Palm leaf": "678750", "Banana leaf": "82A75C", "Grass reed": "879978",
}
NEW_MATERIALS = []
for name, hexval in {**PALETTE, "Garden topsoil": "758666", "Garden fresh earth": "867453", "Lake bank sand": "D5C7A5", "Lake bank clay": "BCAD88", "Lake bottom": "A5B5A1", "Shallow lake water": "90B8B1", "Bridge oak": "BCA176", "Bridge dark oak": "81745A", "V8 bark warm": "776548", "V8 bark silver": "A3977A", "V8 stone pale": "C4BAA0", "V8 stone warm": "A69D80"}.items():
    if name not in MATS:
        material(name, hexval, rough=.88)
        NEW_MATERIALS.append(MATS[name])
    else:
        mat = MATS[name]
        mat.diffuse_color = (*color(hexval), 1)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        target = bsdf.inputs["Base Color"]
        if target.links and target.links[0].from_node.type == "MIX":
            mix = target.links[0].from_node
            if not mix.inputs[6].links:
                mix.inputs[6].default_value = (*color(hexval), 1)
        elif not target.links:
            target.default_value = (*color(hexval), 1)
water = MATS["Shallow lake water"].node_tree.nodes.get("Principled BSDF")
water.inputs["Roughness"].default_value = .19
water.inputs["Metallic"].default_value = .12
water.inputs["Coat Weight"].default_value = .35
water.inputs["Coat Roughness"].default_value = .14

def shade(obj, seed=0):
    """A light, continuous COLOR_0 multiplier; interiors retain their v7 shade."""
    if obj.type != "MESH":
        return
    layer = obj.data.color_attributes.get("Col")
    if layer is not None:
        obj.data.color_attributes.active_color = layer
        obj.data.color_attributes.render_color_index = obj.data.color_attributes.find("Col")
        return
    layer = obj.data.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    obj.data.color_attributes.active_color = layer
    obj.data.color_attributes.render_color_index = obj.data.color_attributes.find("Col")
    for loop in obj.data.loops:
        v = obj.data.vertices[loop.vertex_index]
        normal = v.normal
        noise = .022 * math.sin(v.co.x * 2.7 + v.co.y * 3.6 + seed)
        value = .90 + .08 * max(0, normal.z) + noise
        layer.data[loop.index].color = (value, value, value, 1)

def origin(obj, point):
    scene.cursor.location = point
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.select_set(False)
    return obj

def tag(objects, pid):
    for obj in objects:
        if obj and obj.name in bpy.data.objects:
            obj["v8_island"] = pid
            OWNERSHIP[obj.name] = pid

def polygon_radii(rx, ry, count=120, phase=0):
    points = []
    for i in range(count):
        a = math.tau * i / count
        factor = 1 + .035 * math.sin(a * 3 + phase) + .024 * math.cos(a * 7 - phase) + .016 * math.sin(a * 11)
        points.append((math.cos(a) * rx * factor, math.sin(a) * ry * factor))
    return points

def lake():
    boundary = polygon_radii(20.0, 19.3, 140, .7)
    center_y = 2.0
    water_verts = [(0, center_y, -.16)] + [(x, y + center_y, -.16) for x, y in boundary]
    faces = [(0, i + 1, 1 + (i + 1) % len(boundary)) for i in range(len(boundary))]
    surface = mesh("lake_water", water_verts, faces, "Shallow lake water", uv=True)
    surface["v8_water"] = True
    surface["runtime_animated"] = True
    origin(surface, (0, center_y, -.16))
    verts = []
    profiles = [(1.0, -.71), (1.0, -.13), (1.045, .00), (1.065, -.14), (1.055, -.90)]
    for scale, z in profiles:
        verts += [(x * scale, y * scale + center_y, z + .035 * math.sin(i * .29)) for i, (x, y) in enumerate(boundary)]
    ring_faces = []
    n = len(boundary)
    for r in range(len(profiles) - 1):
        for i in range(n):
            j = (i + 1) % n
            ring_faces.append((r * n + i, r * n + j, (r + 1) * n + j, (r + 1) * n + i))
    ring_faces.append(tuple((len(profiles) - 1) * n + i for i in range(n - 1, -1, -1)))
    bank = mesh("lake_irregular_sand_bank", verts, ring_faces, "Lake bank sand")
    bank.data.materials.append(MATS["Lake bank clay"])
    for face in bank.data.polygons:
        face.material_index = 1 if face.index // n in (0, 3) else 0
    bottom = mesh("lake_sandy_bottom", [(0, center_y, -.72)] + [(x, y + center_y, -.72) for x, y in boundary], faces, "Lake bottom")
    begin = len(WORLD)
    for i in range(67):
        a = math.tau * i / 67
        radius = 1.035 + R.uniform(-.007, .007)
        x = 20 * math.cos(a) * radius
        y = center_y + 19.3 * math.sin(a) * radius
        rock(x, y, -.08, R.uniform(.15, .32))
    join(WORLD[begin:], "lake_shore_pebbles", origin=(0, center_y, -.1))

def foundation(pid, cx, cy, index):
    n = 80
    radius = RADII[pid]
    verts = []
    # Low shelves sit in water rather than floating over a deep pedestal.
    profiles = [(1, .055), (1.009, -.08), (.998, -.29), (.955, -.50), (.92, -.83)]
    for ring, (scale, z) in enumerate(profiles):
        for i in range(n):
            a = math.tau * i / n
            r = radius * (1 + .035 * math.sin(a * 3 + index * .4) + .023 * math.cos(a * 7 - index * .7))
            rough = .02 * math.sin(a * 5) if ring == 0 else .032 * math.sin(a * 9 + ring)
            verts.append((cx + math.cos(a) * r * scale, cy + math.sin(a) * r * scale, z + rough))
    verts.append((cx, cy, .055))
    faces = [(n * len(profiles), i, (i + 1) % n) for i in range(n)]
    for ring in range(len(profiles) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append((ring * n + i, (ring + 1) * n + i, (ring + 1) * n + j, ring * n + j))
    faces.append(tuple((len(profiles) - 1) * n + i for i in range(n - 1, -1, -1)))
    obj = mesh("island_" + pid + "_foundation", verts, faces, "Garden topsoil")
    for name in ("Lake bank sand", "Lake bank clay", "V8 stone pale"):
        obj.data.materials.append(MATS[name])
    for face in obj.data.polygons:
        face.material_index = 0 if face.index < n else (1 if face.index < 2 * n else 2 + (face.index // n) % 2)
    begin = len(WORLD)
    for j in range(28):
        a = j * math.tau / 28 + index * .21
        r = radius * R.uniform(.92, 1.018)
        obj_rock = rock(cx + math.cos(a) * r, cy + math.sin(a) * r, -.07, R.uniform(.17, .38))
    shore = join(WORLD[begin:], "island_" + pid + "_shore_rocks", origin=(cx, cy, 0))
    tag([obj, shore], pid)

def ribbon(name, points, width, mat, height=.09):
    verts = []
    for i, point in enumerate(points):
        direction = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        side = Vector((-direction.y, direction.x, 0)).normalized() * width / 2
        p = Vector((point[0], point[1], point[2] if len(point) > 2 else height))
        verts += [tuple(p - side), tuple(p + side)]
    return mesh(name, verts, [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(len(points) - 1)], mat)

def garden_path(pid, cx, cy, index):
    points = []
    for i in range(71):
        a = math.radians(-170 + i * 340 / 70)
        r = 3.18 + .06 * math.sin(a * 4 + index)
        points.append((cx + math.cos(a) * r, cy + math.sin(a) * r, .092))
    obj = ribbon("island_" + pid + "_garden_path", points, .42, "Warm stone · paths")
    begin = len(WORLD)
    for i in range(6):
        cube("Garden entry paving", (cx + .025 * math.sin(i), cy - 2.64 - i * .20, .10), (.98, .17, .065), "V8 stone pale", .015)
    entry = join(WORLD[begin:], "island_" + pid + "_entry_paving", origin=(cx, cy - 3, .08))
    tag([obj, entry], pid)

def leaf_geometry(name, clusters, count=620, scale=.22, materials=None, origin_point=None, solid=True, flatten=.72):
    mats = materials or ["Garden olive dark", "Garden sage", "Garden olive light", "Garden leaf deep"]
    begin = len(WORLD)
    if solid:
        for ci, (center, radius) in enumerate(clusters):
            core = sphere("Leaf mass", center, (radius * .86, radius * .78, radius * flatten * .76), mats[ci % len(mats)], segments=12, rings=7)
            for v in core.data.vertices:
                v.co *= 1 + .10 * math.sin(v.co.x * 8 + v.co.y * 5 + ci) + .055 * math.cos(v.co.z * 13)
            core.data.update()
    verts, faces, indices, leaf_ids = [], [], [], []
    for ci, (center, radius) in enumerate(clusters):
        center = Vector(center)
        per_cluster = max(12, count // len(clusters))
        for j in range(per_cluster):
            a = R.random() * math.tau
            u = R.uniform(-.90, 1)
            radial = radius * R.uniform(.65, 1.12)
            point = center + Vector((math.cos(a) * math.sqrt(1 - u * u), math.sin(a) * math.sqrt(1 - u * u), u * flatten)) * radial
            d = Vector((math.cos(a + .2), math.sin(a + .2), R.uniform(-.25, .65))).normalized()
            s = Vector((-d.y, d.x, 0)).normalized()
            length = scale * R.uniform(.64, 1.43)
            width = length * .27
            start = len(verts)
            verts += [tuple(point - d * length * .54), tuple(point + s * width), tuple(point + Vector((0, 0, length * .12))), tuple(point - s * width), tuple(point + d * length * .55)]
            faces += [(start, start + 1, start + 2), (start, start + 2, start + 3), (start + 1, start + 4, start + 2), (start + 2, start + 4, start + 3)]
            indices += [R.randrange(len(mats))] * 4
            leaf_ids += [ci * 10000 + j + 1] * 4
    outline = mesh(name + "_detail", verts, faces, mats[0], uv=False)
    for mat in mats[1:]:
        outline.data.materials.append(MATS[mat])
    for face, index in zip(outline.data.polygons, indices):
        face.material_index = index
    attribute = outline.data.attributes.new("leaf_id", "INT", "FACE")
    for slot, value in zip(attribute.data, leaf_ids):
        slot.value = value
    # Give all pieces consistent COLOR_0 before joining; the LOD keeps complete leaves.
    for obj in WORLD[begin:]:
        shade(obj)
    canopy = join(WORLD[begin:], name, origin=origin_point)
    canopy["v8_foliage"] = True
    AMBIENT.append(canopy.name)
    return canopy

def woody_tree(pid, name, x, y, height=4.8, spread=1.2, style="broad", flower=None):
    begin = len(WORLD)
    base = Vector((x, y, .08))
    trunk_top = Vector((x + .18, y + .07, height * .66))
    bark = "V8 bark silver" if style == "fruit" else "V8 bark warm"
    for i in range(7):
        a = i * math.tau / 7 + .17
        foot = base + Vector((math.cos(a) * .63, math.sin(a) * .53, -.02))
        elbow = base + Vector((math.cos(a) * .17, math.sin(a) * .17, .24))
        segment("Tree buttress root", foot, elbow, .067, bark, r2=.105, vertices=9)
        segment("Tree buttress rise", elbow, base + Vector((0, 0, .68)), .095, bark, r2=.075, vertices=9)
    p1 = base.lerp(trunk_top, .46) + Vector((-.065, .09, 0))
    segment("Tree lower trunk", base, p1, .19, bark, r2=.145, vertices=14)
    segment("Tree articulated trunk", p1, trunk_top, .145, bark, r2=.053, vertices=12)
    clusters = []
    if style == "araucaria":
        for tier in range(3):
            z = height * (.57 + .17 * tier)
            rad = spread * (1.18 - tier * .17)
            for i in range(7):
                a = i * math.tau / 7 + tier * .38
                start = Vector((x + .12, y, z - .27))
                end = Vector((x + math.cos(a) * rad, y + math.sin(a) * rad, z))
                elbow = start.lerp(end, .60) - Vector((0, 0, .13))
                segment("Araucaria radial branch", start, elbow, .054, bark, r2=.035, vertices=8)
                segment("Araucaria lifted branch", elbow, end, .035, bark, r2=.015, vertices=7)
                clusters.append((end, spread * .30))
        clusters.append(((x + .14, y, height), spread * .38))
    else:
        for i in range(11):
            a = i * 2.39996 + R.uniform(-.3, .3)
            radial = spread * R.uniform(.38, 1.0)
            z = height * R.uniform(.67, .96)
            end = Vector((x + math.cos(a) * radial, y + math.sin(a) * radial, z))
            start = base.lerp(trunk_top, R.uniform(.53, .95))
            elbow = start.lerp(end, .54) + Vector((0, 0, .17))
            segment("Tree organic branch", start, elbow, .070, bark, r2=.044, vertices=9)
            segment("Tree branch tip", elbow, end, .044, bark, r2=.012, vertices=7)
            for j in range(2):
                tip = end + Vector((R.uniform(-.24, .24), R.uniform(-.24, .24), R.uniform(-.05, .22)))
                segment("Tree fine twig", elbow.lerp(end, .7), tip, .017, bark, r2=.006, vertices=6)
            clusters.append((end, spread * R.uniform(.43, .55)))
        clusters.append(((x + .09, y, height * .98), spread * .53))
    wood = join(WORLD[begin:], "island_" + pid + "_" + name + "_wood", origin=(x, y, .08))
    leaf_materials = None
    if style == "fruit":
        leaf_materials = ["Garden leaf deep", "Garden olive dark", "Garden sage"]
    if style == "feather":
        leaf_materials = ["Garden sage", "Garden olive light", "Garden olive dark"]
    leaves = leaf_geometry("ambient_leaves_" + pid + "_" + name, clusters, count=460 if style == "araucaria" else 610, scale=.14 if style in ("araucaria", "feather") else .22, materials=leaf_materials, origin_point=(x, y, height * .54), flatten=.48 if style == "araucaria" else .66)
    flowers = None
    if flower:
        # Separate flowering twigs sway around the crown base, not the trunk.
        blossom_clusters = [(Vector(c) + Vector((0, 0, .1)), radius * .84) for c, radius in clusters[::2]]
        flowers = leaf_geometry("ambient_flowers_" + pid + "_" + name, blossom_clusters, count=260, scale=.14, materials=[flower, flower], origin_point=(x, y, height * .60), solid=True, flatten=.55)
    tag([wood, leaves, flowers], pid)
    TREE_RECORDS.append({"island": pid, "kind": name, "height": height, "canopy": leaves.name, "wood": wood.name, "illustrative": True})
    PERCHES.append({"position": [round(x + spread * .48, 3), round(height * .89, 3), round(-y - spread * .17, 3)], "island": pid})
    return leaves

def palm(pid, name, x, y, height=5.7, spread=1.65):
    begin = len(WORLD)
    points = [Vector((x + .17 * math.sin(t * 1.5), y + .08 * math.sin(t), .08 + t * (height - .08))) for t in [i / 9 for i in range(10)]]
    for i, (a, b) in enumerate(zip(points, points[1:])):
        segment("Palm curved trunk", a, b, .14 - i * .004, "V8 bark warm", r2=.134 - i * .004, vertices=12)
        cylinder("Palm trunk scar", b, .141 - i * .004, .045, "V8 bark silver", vertices=12, bevel=0)
    wood = join(WORLD[begin:], "island_" + pid + "_" + name + "_wood", origin=(x, y, .08))
    begin = len(WORLD)
    top = points[-1]
    verts, faces, ids = [], [], []
    for i in range(13):
        a = i * math.tau / 13
        d = Vector((math.cos(a), math.sin(a), 0))
        s = Vector((-math.sin(a), math.cos(a), 0))
        length = spread * R.uniform(.85, 1.22)
        curve = [top + d * length * t + Vector((0, 0, .46 * math.sin(t * math.pi) - .58 * t * t)) for t in [j / 12 for j in range(13)]]
        line("Palm frond rachis", curve, .016, "Garden leaf deep")
        for j in range(1, 12):
            p = curve[j]
            width = length * .26 * math.sin(j / 12 * math.pi) + .02
            for sign in (-1, 1):
                end = p + s * width * sign + d * .11 + Vector((0, 0, -.12))
                mid = p.lerp(end, .52) + Vector((0, 0, .028))
                idx = len(verts)
                verts += [tuple(p), tuple(mid + d * .0925), tuple(end), tuple(mid - d * .0875)]
                faces += [(idx, idx + 1, idx + 2), (idx, idx + 2, idx + 3)]
                ids += [i * 1000 + j * 2 + (1 if sign > 0 else 0) + 1] * 2
    frond = mesh("Palm feather leaflets", verts, faces, "Palm leaf", uv=False)
    frond.data.materials.append(MATS["Garden olive light"])
    for f in frond.data.polygons:
        f.material_index = 1 if f.index % 9 == 0 else 0
    attr = frond.data.attributes.new("leaf_id", "INT", "FACE")
    for slot, value in zip(attr.data, ids): slot.value = value
    for obj in WORLD[begin:]: shade(obj)
    canopy = join(WORLD[begin:], "ambient_leaves_" + pid + "_" + name, origin=top)
    canopy["v8_foliage"] = True
    AMBIENT.append(canopy.name)
    tag([wood, canopy], pid)
    TREE_RECORDS.append({"island": pid, "kind": name, "height": height, "canopy": canopy.name, "wood": wood.name, "illustrative": True})
    PERCHES.append({"position": [round(top.x, 3), round(top.z + .05, 3), round(-top.y, 3)], "island": pid})

def banana(pid, x, y, height=3.9):
    begin = len(WORLD)
    top = Vector((x, y, height))
    for i in range(3):
        a = i * 2.4
        foot = Vector((x + math.cos(a) * .16, y + math.sin(a) * .16, .08))
        segment("Banana pseudostem", foot, top + Vector((.06 * i, .04 * i, -.12 * i)), .15, "V8 bark silver", r2=.067, vertices=10)
    wood = join(WORLD[begin:], "island_" + pid + "_banana_wood", origin=(x, y, .08))
    verts, faces = [], []
    for i in range(11):
        a = i * 2.39996
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-math.sin(a), math.cos(a), 0))
        length = R.uniform(1.08, 1.80)
        for j in range(9):
            t = j / 8
            p = top + d * length * t + Vector((0, 0, .44 * math.sin(t * math.pi) - .52 * t * t))
            width = .31 * math.sin(t * math.pi) ** .7
            verts += [tuple(p - side * width), tuple(p + Vector((0, 0, .038))), tuple(p + side * width)]
            if j:
                idx = len(verts) - 6
                faces += [(idx, idx + 3, idx + 4, idx + 1), (idx + 1, idx + 4, idx + 5, idx + 2)]
    leaves = mesh("ambient_leaves_" + pid + "_banana", verts, faces, "Banana leaf", uv=False)
    leaves.data.materials.append(MATS["Garden olive light"])
    for f in leaves.data.polygons: f.material_index = f.index % 7 == 0
    origin(leaves, (x, y, height * .88))
    leaves["v8_foliage"] = True
    AMBIENT.append(leaves.name)
    tag([wood, leaves], pid)
    TREE_RECORDS.append({"island": pid, "kind": "banana", "height": height, "canopy": leaves.name, "wood": wood.name, "illustrative": True})
    PERCHES.append({"position": [x, height, -y], "island": pid})

def grasses(pid, name, cx, cy, count=17, radius=.57, height=.65, flower=None):
    verts, faces = [], []
    for bunch in range(count):
        a = R.random() * math.tau
        r = radius * math.sqrt(R.random())
        base = Vector((cx + math.cos(a) * r, cy + math.sin(a) * r, .075))
        for leaf in range(6):
            angle = leaf * 2.39996 + a
            d = Vector((math.cos(angle), math.sin(angle), 0))
            side = Vector((-d.y, d.x, 0))
            h = height * R.uniform(.60, 1.16)
            idx = len(verts)
            for j in range(4):
                t = j / 3
                p = base + d * h * .49 * t * t + Vector((0, 0, h * math.sin(t * 1.65)))
                width = .026 * (1 - t) + .002
                verts += [tuple(p - side * width), tuple(p + side * width)]
                if j: faces.append((idx + 2 * j - 2, idx + 2 * j - 1, idx + 2 * j + 1, idx + 2 * j))
    obj = mesh("ambient_leaves_" + pid + "_grasses_" + name, verts, faces, "Grass reed", uv=False)
    origin(obj, (cx, cy, .07))
    obj["v8_foliage"] = True
    AMBIENT.append(obj.name)
    tag([obj], pid)
    if flower:
        flower_patch(pid, name, cx, cy, 11, radius * .77, flower, height * .8)

def flower_patch(pid, name, cx, cy, count=27, radius=.57, mat="Flower coral", height=.49):
    begin = len(WORLD)
    verts, faces = [], []
    for i in range(count):
        a = R.random() * math.tau
        r = radius * math.sqrt(R.random())
        stem = Vector((cx + math.cos(a) * r, cy + math.sin(a) * r, .08))
        top = stem + Vector((R.uniform(-.06, .06), R.uniform(-.06, .06), height * R.uniform(.55, 1.15)))
        segment("Flower stem", stem, top, .009, "Garden leaf deep", r2=.005, vertices=5)
        for j in range(5):
            angle = j * math.tau / 5
            d = Vector((math.cos(angle), math.sin(angle), .17))
            s = Vector((-d.y, d.x, 0))
            p = top + d * .066
            idx = len(verts)
            verts += [tuple(top), tuple(p + s * .044), tuple(top + d * .132 + Vector((0, 0, .024))), tuple(p - s * .044), tuple(p + Vector((0, 0, .025)))]
            faces += [(idx, idx + 1, idx + 4), (idx + 1, idx + 2, idx + 4), (idx + 2, idx + 3, idx + 4), (idx + 3, idx, idx + 4)]
        sphere("Flower golden center", top + Vector((0, 0, .013)), (.029, .029, .028), "Flower ipe gold", segments=7, rings=5)
    petal = mesh("Flower shaped petals", verts, faces, mat, uv=False)
    for obj in WORLD[begin:]: shade(obj)
    obj = join(WORLD[begin:], "ambient_flowers_" + pid + "_" + name, origin=(cx, cy, .08))
    obj["v8_foliage"] = True
    AMBIENT.append(obj.name)
    tag([obj], pid)

def planted_bed(pid, cx, cy, rx, ry, phase):
    boundary = polygon_radii(rx, ry, 28, phase)
    bed = mesh("Garden organic planting earth", [(cx, cy, .078)] + [(cx + x, cy + y, .077) for x, y in boundary], [(0, i + 1, 1 + (i + 1) % len(boundary)) for i in range(len(boundary))], "Garden fresh earth")
    begin = len(WORLD)
    for i in range(18):
        a = i * math.tau / 18
        rock(cx + math.cos(a) * rx * 1.06, cy + math.sin(a) * ry * 1.06, .07, R.uniform(.065, .11))
    edging = join(WORLD[begin:], "Garden pebble edging", origin=(cx, cy, .08))
    tag([bed, edging], pid)

def rosette(pid, cx, cy, scale=.6):
    verts, faces = [], []
    for i in range(11):
        a = i * 2.39996
        d = Vector((math.cos(a), math.sin(a), 0))
        s = Vector((-d.y, d.x, 0))
        length = scale * R.uniform(.7, 1.2)
        idx = len(verts)
        base = Vector((cx, cy, .08))
        for j in range(5):
            t = j / 4
            p = base + d * length * .70 * t + Vector((0, 0, length * (.65 * math.sin(t * 2.2))))
            width = length * .09 * math.sin(t * math.pi) + .005
            verts += [tuple(p - s * width), tuple(p + s * width)]
            if j: faces.append((idx + 2*j - 2, idx + 2*j - 1, idx + 2*j + 1, idx + 2*j))
    return mesh("Bromeliad garden rosette", verts, faces, "Garden olive dark", uv=False)

def island_garden(pid, cx, cy, index):
    begin = len(WORLD)
    beds = [(-3.10, -.55, .62, 1.07), (3.04, .90, .57, 1.2), (-.18, 3.40, 1.65, .38), (-2.43, -2.57, .63, .43), (2.39, -2.65, .64, .39)]
    for bi, (dx, dy, rx, ry) in enumerate(beds):
        planted_bed(pid, cx + dx, cy + dy, rx, ry, index + bi * .4)
        if bi in (0, 1):
            grasses(pid, str(bi), cx + dx, cy + dy, count=17, radius=.48, height=.62 + .06 * bi)
        elif bi in (3, 4):
            flower_patch(pid, str(bi), cx + dx, cy + dy, count=20, radius=.46, mat=("Flower coral", "Flower ivory", "Flower blue", "Flower ipe rose", "Flower quaresmeira", "Flower ivory", "Flower ipe gold")[index], height=.42)
    # Patchy, irregular planting replaces the repeated uniformly spaced shrubs.
    for i in range(19):
        a = R.uniform(.04, math.pi - .03)
        radius = R.uniform(3.46, 3.93)
        x, y = cx + math.cos(a) * radius, cy + math.sin(a) * radius
        s = R.uniform(.21, .39)
        sphere("Garden low foliage", (x, y, .12 + s * .38), (s * 1.1, s * .83, s * .69), "Garden sage" if i % 3 else "Garden olive dark", segments=9, rings=6)
        if i % 3 == 0: rosette(pid, x + .14, y - .18, R.uniform(.42, .63))
    static = [o for o in WORLD[begin:] if not o.name.startswith("ambient_")]
    shrub = join(static, "island_" + pid + "_planted_garden", origin=(cx, cy, .06))
    tag([shrub], pid)
    # Position crowns beside/behind furniture, leaving the front entrance open.
    if pid == "pesquisa":
        woody_tree(pid, "ipe_amarelo", cx - 2.93, cy + 1.61, 5.0, 1.28, flower="Flower ipe gold")
        woody_tree(pid, "jabuticabeira", cx + 2.99, cy + 1.62, 3.7, .91, style="fruit")
    elif pid == "gerar":
        palm(pid, "palmeira", cx - 2.94, cy + 1.44, 5.75, 1.70)
        woody_tree(pid, "pitangueira", cx + 3.0, cy + 1.64, 3.9, 1.07, style="fruit")
    elif pid == "comparar":
        woody_tree(pid, "quaresmeira", cx - 2.99, cy + 1.46, 4.9, 1.17, flower="Flower quaresmeira")
        woody_tree(pid, "pau_brasil", cx + 2.98, cy + 1.77, 4.2, 1.0, style="feather")
    elif pid == "validar":
        woody_tree(pid, "araucaria", cx - 3.02, cy + 1.53, 5.65, 1.32, style="araucaria")
        woody_tree(pid, "jabuticabeira", cx + 2.98, cy + 1.69, 3.8, .97, style="fruit")
    elif pid == "especificar":
        woody_tree(pid, "pau_brasil", cx - 2.99, cy + 1.56, 4.8, 1.23, style="feather")
        palm(pid, "palmeira_jovem", cx + 3.05, cy + 1.52, 4.5, 1.37)
    elif pid == "evoluir":
        banana(pid, cx - 3.03, cy + 1.64, 4.05)
        woody_tree(pid, "pitangueira", cx + 3.01, cy + 1.54, 4.15, 1.07, style="fruit")
    else:
        woody_tree(pid, "ipe_roxo", cx - 2.99, cy + 1.66, 5.0, 1.28, flower="Flower ipe rose")
        palm(pid, "palmeira", cx + 3.0, cy + 1.62, 5.1, 1.47)

def bridge(from_id, to_id):
    centers = {pid: Vector((cx, cy, 0)) for pid, cx, cy in LAYOUT}
    a, b = centers[from_id], centers[to_id]
    d = (b - a).normalized()
    side = Vector((-d.y, d.x, 0))
    start = a + d * (RADII[from_id] - .10)
    end = b - d * (RADII[to_id] - .10)
    length = (end - start).length
    begin = len(WORLD)
    steps = max(12, int(length / .16))
    for i in range(steps + 1):
        t = i / steps
        center = start.lerp(end, t)
        center.z = .13 + .21 * math.sin(t * math.pi)
        plank = cube("Bridge hand fitted oak plank", center, (1.03, length / steps * .93, .11), "Bridge oak", .015)
        # Cubes' long X dimension is the bridge width.
        plank.rotation_euler.z = math.atan2(d.y, d.x) - math.pi / 2
    for sign in (-1, 1):
        rail_points = []
        lower_points = []
        for i in range(6):
            t = i / 5
            p = start.lerp(end, t) + side * .52 * sign
            deck_height = .13 + .21 * math.sin(t * math.pi)
            p.z = deck_height + .73
            segment("Bridge guardrail post", (p.x, p.y, deck_height - .035), p, .035, "Bridge dark oak", vertices=8)
            rail_points.append(p)
            lower_points.append(Vector((p.x, p.y, deck_height + .32)))
        line("Bridge curved handrail", rail_points, .032, "Bridge oak")
        line("Bridge lower rail", lower_points, .018, "Bridge dark oak")
        for t in (.15, .84):
            p = start.lerp(end, t) + side * .42 * sign
            segment("Bridge shallow water pier", (p.x, p.y, -.64), (p.x, p.y, .26), .065, "Bridge dark oak", vertices=10)
    obj = join(WORLD[begin:], "bridge_" + from_id + "_" + to_id, origin=tuple((start + end) / 2))
    obj["v8_bridge_from"] = from_id
    obj["v8_bridge_to"] = to_id
    BRIDGES.append({"from": from_id, "to": to_id, "nodes": [obj.name]})

lake()
for index, (pid, cx, cy) in enumerate(LAYOUT):
    print("V8_AUTHORING_ISLAND", pid, flush=True)
    foundation(pid, cx, cy, index)
    garden_path(pid, cx, cy, index)
    island_garden(pid, cx, cy, index)
for from_id, to_id in zip(IDS, IDS[1:]): bridge(from_id, to_id)

for obj in WORLD:
    obj.data.validate(verbose=False)
    obj.data.update()
    shade(obj)
for mat in NEW_MATERIALS:
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    base = bsdf.inputs["Base Color"]
    constant = base.default_value[:]
    vertex = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = "Col"
    multiply = mat.node_tree.nodes.new("ShaderNodeMix")
    multiply.data_type = "RGBA"; multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    multiply.inputs[6].default_value = constant
    mat.node_tree.links.new(vertex.outputs["Color"], multiply.inputs[7])
    mat.node_tree.links.new(multiply.outputs[2], base)

CAM_WORLD = [1.8, 29.2, 43.5]
TARGET_WORLD = [0, .8, -1.6]
CAM_FOV = 38
def to_blender(v): return Vector((v[0], -v[2], v[1]))
camera = scene.camera
camera.name = "V8 garden overview camera"
camera.data.sensor_fit = "VERTICAL"
camera.data.lens = camera.data.sensor_height / (2 * math.tan(math.radians(CAM_FOV) / 2))
camera.location = to_blender(CAM_WORLD)
camera.rotation_euler = (to_blender(TARGET_WORLD) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.render.resolution_x = 1800; scene.render.resolution_y = 1350; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"; scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"; scene.view_settings.look = "AgX - Medium High Contrast"; scene.view_settings.exposure = .36
scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (*color("DDE7DD"), 1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value = .72
for lamp in [o for o in scene.objects if o.type == "LIGHT"]:
    lamp.name = lamp.name.replace("V7", "V8")
    if lamp.data.type == "AREA": lamp.data.energy *= 1.12
ground = bpy.data.objects.get("Poster shadow ground")
ground.location.z = -.99
ground.scale.x = 10; ground.scale.y = 10

old = json.loads((OUT / "manifest-v7.json").read_text(encoding="utf-8"))
manifest = json.loads(json.dumps(old))
manifest.update({"schemaVersion": 2, "version": 8})
manifest["assets"].update({"world": "/experience/world/archipelago-v8.glb", "worldLow": "/experience/world/archipelago-v8-low.glb", "poster": "/experience/world/poster-v8.webp"})
manifest["initialCamera"] = {"position": CAM_WORLD, "target": TARGET_WORLD, "fov": CAM_FOV}
manifest["spawn"] = [-11.0, .629, 10.75]
manifest["navigation"]["nodes"] = {"spawn": {"position": manifest["spawn"]}}
manifest["navigation"]["edges"] = []
for pid, cx, cy in LAYOUT:
    entry = [cx, .629, round(-cy + 1.74, 4)]
    focus = [cx, 5.12 if pid == "perspectivas" else 4.22, round(-cy - .14, 4)]
    projected = world_to_camera_view(scene, camera, to_blender(focus))
    pose = {"position": [cx + 5.45, 7.55 if pid == "perspectivas" else 7.05, round(-cy + 11.9, 4)], "target": [cx, 1.62 if pid == "perspectivas" else 1.34, -cy], "fov": 45}
    manifest["pavilions"][pid].update({"entry": entry, "focus": focus, "camera": pose, "posterPoint": [round(projected.x, 5), round(1 - projected.y, 5)], "editorial": "/experience/editorial/v8/" + pid + ".webp", "thumbnail": "/experience/world/thumb-v8-" + pid + ".webp"})
    manifest["navigation"]["nodes"][pid + "_entry"] = {"position": entry}
    manifest["navigation"]["edges"].append(["spawn", pid + "_entry"])
    manifest["islands"][pid].update({"center": [cx, 0, -cy], "radius": RADII[pid] + .22})
manifest["ambientNodes"] = AMBIENT
manifest["foliagePalette"] = PALETTE
manifest["bridges"] = BRIDGES
manifest["birdPerches"] = PERCHES
manifest["cameraBounds"] = {"minZoom": .8, "maxZoom": 2}
manifest["weatherScenery"]["lightningTargets"] = [[-27, 0, -25], [27, 0, -25], [25, 0, 22]]
(OUT / "manifest-v8.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print("V8_MANIFEST_WRITTEN", str(OUT / "manifest-v8.json"), flush=True)

bpy.context.preferences.filepaths.save_version = 0
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "archipelago-v8.blend"), compress=True)
if "--skip-preview" not in ARGS:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 32; scene.eevee.use_raytracing = True
    scene.render.resolution_x = 1280; scene.render.resolution_y = 960
    scene.render.filepath = str(SOURCE / "poster-v8-preview.png")
    bpy.ops.render.render(write_still=True)
    print("V8_FIRST_POSTER", scene.render.filepath, flush=True)

def selected():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in WORLD: obj.select_set(True)
    bpy.context.view_layer.objects.active = WORLD[0]
common = dict(export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False, export_image_format="JPEG", export_jpeg_quality=84, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_vertex_color="NAME", export_vertex_color_name="Col", export_all_vertex_colors=False, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10, export_draco_position_quantization=13, export_draco_normal_quantization=8, export_draco_texcoord_quantization=10, export_draco_color_quantization=7)
selected()
bpy.ops.export_scene.gltf(filepath=str(OUT / "archipelago-v8.glb"), **common)
print("V8_HIGH_EXPORTED", (OUT / "archipelago-v8.glb").stat().st_size, flush=True)
original_meshes = {}
high_polygons = sum(len(obj.data.polygons) for obj in WORLD)
for obj in WORLD:
    original_meshes[obj.name] = obj.data
    obj.data = obj.data.copy()
    if obj.get("v8_foliage"):
        bm = bmesh.new(); bm.from_mesh(obj.data)
        layer = bm.faces.layers.int.get("leaf_id")
        has_leaves = layer is not None
        if has_leaves:
            remove = [face for face in bm.faces if face[layer] > 0 and (face[layer] * 2654435761) % 10 >= 3]
            bmesh.ops.delete(bm, geom=remove, context="FACES")
            bm.to_mesh(obj.data)
        bm.free()
        if has_leaves: continue
    if obj.name.startswith("pavilion_"): ratio = .24
    elif "planted_garden" in obj.name or "shore_pebbles" in obj.name: ratio = .29
    elif "foundation" in obj.name or "bank" in obj.name: ratio = .56
    elif "_wood" in obj.name: ratio = .49
    else: ratio = .36
    if len(obj.data.polygons) > 140:
        mod = obj.modifiers.new("V8 silhouette retaining low detail", "DECIMATE")
        mod.ratio = ratio; mod.use_collapse_triangulate = True
        apply_modifiers(obj)
        obj.data.validate(verbose=False); obj.data.update()
selected()
low_common = {**common, "export_jpeg_quality": 73, "export_draco_mesh_compression_level": 10, "export_draco_position_quantization": 11, "export_draco_normal_quantization": 7, "export_draco_texcoord_quantization": 9, "export_draco_color_quantization": 6}
bpy.ops.export_scene.gltf(filepath=str(OUT / "archipelago-v8-low.glb"), **low_common)
low_polygons = sum(len(obj.data.polygons) for obj in WORLD)
print("V8_LOW_EXPORTED", (OUT / "archipelago-v8-low.glb").stat().st_size, flush=True)
for name, data in original_meshes.items(): bpy.data.objects[name].data = data
report = {"version": 8, "blender": bpy.app.version_string, "worldBytes": (OUT / "archipelago-v8.glb").stat().st_size, "lowBytes": (OUT / "archipelago-v8-low.glb").stat().st_size, "worldMeshes": len(WORLD), "worldPolygons": high_polygons, "lowPolygons": low_polygons, "islands": 7, "bridges": 6, "layout": "Continuous U; research front-left; perspectives front-right", "source": "assets/world/archipelago-v8.blend", "baseSource": "assets/world/archipelago-v7.blend", "pavilionFurniture": "Original v7 meshes preserved intact", "botany": "Illustrative models inspired by Brazilian gardens; not botanical reconstructions", "trees": TREE_RECORDS, "ambientNodes": len(AMBIENT), "ownership": OWNERSHIP, "camera": manifest["initialCamera"], "render": "preview completed; full renders pending", "navigation": "legacy direct graph retained", "avatarLoaded": False, "budgets": {"world": 8000000, "worldLow": 4000000}, "vertexShading": "COLOR_0 light continuous multiplier; pavilion shading preserved", "assetSha256": {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ("archipelago-v8.glb", "archipelago-v8-low.glb")}}
(SOURCE / "build-report-v8.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
assert report["worldBytes"] <= 8000000, report["worldBytes"]
assert report["lowBytes"] <= 4000000, report["lowBytes"]
print("V8_BUILD_COMPLETE", json.dumps({k: report[k] for k in ("worldBytes", "lowBytes", "worldMeshes", "worldPolygons", "lowPolygons", "ambientNodes")}), flush=True)
