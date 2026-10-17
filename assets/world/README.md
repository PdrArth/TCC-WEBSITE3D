# Authored island assets

## Version 8: connected Brazilian miniature garden

`archipelago-v8.blend` is the editable, real 3D source. The seven complete v7
pavilion meshes, including furniture and authored interiors, are preserved.
New broad planted islands sit in a shallow irregular lake: research starts at
the front left, then the six physical bridges follow the reading order around
the U to the perspective lighthouse at the front right. Bridge spans begin at
the island shores, outside the pavilion terraces. The lake has an irregular
sand/clay bank, a bottom, stones and the separately named `lake_water` plane.
Its exported local coordinates are XZ, with local Y=0 and translation Y=-0.16;
the runtime supplies the water movement.

The tree forms are original illustrations inspired by ipê, quaresmeira,
jabuticabeira, pitangueira, pau-brasil, araucaria, palms and banana plants.
They are not botanical reconstructions or claims about one Brazilian climate.
Branching trunks, buttress roots, irregular crowns, palm feather leaflets,
arched broad leaves, flowers and grasses provide different silhouettes.
`ambient_leaves_*` and `ambient_flowers_*` are independently pivoted at branches
or planting roots. No trunk, foundation, path or furnished pavilion appears in
`ambientNodes`. Fourteen `birdPerches` cover all seven islands.

`manifest-v8.json` uses schemaVersion 2 and keeps the v7-compatible fields,
including the legacy direct navigation graph and the preserved avatar URL.
The world GLBs contain no avatar, camera, light, photographic plane or baked
runtime animation. The added contract contains six consecutive `bridges`,
`birdPerches` and `cameraBounds` from 0.8 to 2. Both LODs retain identical node
names, all crown cores and all seven hit targets. `COLOR_0` is a gentle shade
multiplier; pavilion interior shading is preserved from the approved source.

Public assets are `experience/world/archipelago-v8.glb`,
`archipelago-v8-low.glb`, `poster-v8.webp` and seven
`thumb-v8-{id}.webp`; all seven editorial images live in
`experience/editorial/v8/{id}.webp`. The poster is 1800×1350, editorial renders
are 1200×780 and thumbnails are 512×333. Every raster derivative comes from a
real v8 Blender render. No stable editorial image or version 7 asset is changed
by the v8 asset scripts.

Rebuild with Blender 4.5.14 LTS and four threads:

1. Run `blender --background --threads 4 --python scripts/world/build_world_v8.py`.
2. To optimize exports from the retained source without rebuilding, run
   `blender --background --threads 4 assets/world/archipelago-v8.blend --python scripts/world/refine_exports_v8.py`.
3. Run `blender --background --threads 4 assets/world/archipelago-v8.blend --python scripts/world/render_archipelago_v8.py`.
4. Run `python scripts/world/finish_archipelago_v8.py`, then
   `python scripts/world/verify_assets_v8.py`.
5. Verify furniture, actual bridge clearance and plant pivots with
   `blender --background --threads 2 assets/world/archipelago-v8.blend --python scripts/world/verify_source_v8.py`.

The decimal budgets are high ≤8,000,000 bytes and low ≤4,000,000 bytes.
The final v8 exports measure 7,770,016 bytes high and 3,413,380 bytes low.
`build-report-v8.json` records measured sizes, hashes, botanical illustration
scope, source ownership and render provenance. `verification-v8.json` checks
both budgets, true 3D meshes, all destinations, bridges, perches, embedded
textures, `COLOR_0`, images and framing. `framing-v8.json` records projections
of actual geometry at 1280×720, 390×844 and 1800×1350; runtime UI and labels need
their separate browser check. `verification-source-v8.json` proves the seven
pavilion mesh topologies/coordinates are identical to v7 and measures physical
clearance of all six bridges against every pavilion. Version 7 remains
preserved for comparison and rollback.

## Version 7: seven ordered garden islands

The preserved `manifest-v7.json` selects `archipelago-v7.glb`, `archipelago-v7-low.glb`
and `poster-v7.webp`, retaining an explicit copy of this version's contract.
The previous four-island contract is retained as `manifest-v6.json`.
The seven real destinations follow the reading order: pesquisa, gerar, comparar,
validar, especificar, evoluir and perspectivas. Each has a separated organic
limestone foundation, garden, authored hit mesh and focused camera. Research uses
an open archive arch and telescope; comparison is a two-bench laboratory;
validation is an open review loggia; the final perspective garden has a lighthouse.
The generation, specification and profession studios reuse the furnished v6
models, with the correct new stage numbers. There is no additional decorative
island that could be confused with a reading destination.

The editable scene is `archipelago-v7.blend`. The GLBs exclude the avatar,
poster plane, lights and camera. Fourteen separate canopy objects have their
pivots inside the crowns and are listed in `ambientNodes`. Each canopy combines
closed sculpted foliage volumes with actual ridged leaf surfaces. The low model
retains every canopy core and selects whole leaves evenly across its clusters;
it does not clip a partial triangle range. The mixed `island_*_groundcover`
meshes contain planting, rocks and flowers with origins at island ground level,
and must not be scaled as if they were individual tree crowns.

All exported primitives carry `COLOR_0`, a restrained multiplier for cavity and
vegetation shading. Physical material colors and embedded local CC0 textures
remain independent, including the named `Garden olive dark`, `Garden sage`,
`Garden olive light`, `Garden leaf deep`, `Garden dry tip`, `Flower ivory` and
`Flower blue` materials used by the site's seasonal palette. This is a stylized
garden scene, not a claim about a particular tree species or measured climate.

The overview and all seven editorial images are renders of the preserved v7
scene. Public 1200×780 editorial WebPs live in `experience/editorial/v7/` and
the stable `experience/editorial/` paths; 512×333 thumbnails live in
`experience/world/thumb-v7-{id}.webp`. The poster is 1800×1350. The previous
four editorial images are retained in `experience/editorial/v6/`.
`build-report-v7.json` records final sizes, hashes and actual render provenance.
`verification-v7.json` checks all destination names, seven island gaps, both LOD
contracts, embedded images, vertex shades, budgets and compatibility navigation.
`framing-v7.json` records desktop and portrait camera projections using the
site's portrait FOV cap and camera distance adjustment.

To rebuild v7 in Blender 4.5 LTS, run `build_world_v7.py -- --skip-render`, then
open `assets/world/archipelago-v7.blend` with `refine_exports_v7.py` and
`render_archipelago_v7.py`. Use `--threads 4` for renders. Finish with
`python scripts/world/finish_archipelago_v7.py` and
`python scripts/world/verify_assets_v7.py`. The original model and every v6
GLB, source scene, poster and report remain available.

## Version 6: four separate islands

The archived v6 exports are `archipelago-v6.glb` and `archipelago-v6-low.glb`.
They retain the original furnished pavilion geometry and CC0 embedded textures,
with four separate stratified limestone foundations, entrance terraces and local
gardens. There is no shared central island or pedestrian route between them.
Selection uses the four authored cameras directly; the original visitor asset is
preserved but the v6 renderer does not request it. The compatibility navigation
edges represent selections, not physical footpaths.

The editable v6 source is `archipelago-v6.blend`. Previous `island.blend`,
`island.glb`, `island-low.glb`, `poster.webp` and their original reports remain
available. The v6 fallback is `poster-v6.webp`, and its four preserved editorial WebP
files in `public/experience/editorial/v6/` are renders of those actual models at
1000×650, using each manifest camera. `build-report-v6.json` records sizes, hashes
and provenance; `verification-v6.json` records the structural checks.

To rebuild v6, run `build_world.py -- --skip-render`, then run Blender with
`assets/world/archipelago-v6.blend --python scripts/world/render_archipelago.py`,
then `python scripts/world/finish_archipelago.py` and
`python scripts/world/verify_assets.py`. The original assets are not overwritten.

The runtime seasons are conventional Southern Hemisphere meteorological
quarters: December–February, March–May, June–August and September–November.
They are explicitly distinct from exact equinox/solstice dates. The visual
interpretation uses inland Minas Gerais / Southeast Brazil, not a uniform climate
for all of Brazil: spring has new green and flowers; summer has deeper vegetation
and more scenic rain; autumn gradually dries; winter shows straw tones and fewer
real leaf triangles, retaining visible branches. There is no snow or European
red-leaf autumn. Color and session-weather probabilities are artistic choices,
not measured local forecasts or claims about individual plant species.

Primary climate context consulted on 2026-10-11:

- INMET, spring transition from dry to rainy season: https://portal.inmet.gov.br/noticias/primavera-2026-confira-a-previsao-para-a-estacao
- INMET, dry winter in Minas Gerais: https://portal.inmet.gov.br/noticias/minas-gerais-caracter%C3%ADsticas-do-inverno
- INMET/INPE, summer precipitation and ZCAS in Southeast Brazil: https://portal.inmet.gov.br/uploads/notastecnicas/Prognostico_Verao_2026.pdf

Birds are original minimal mesh silhouettes with six smooth waypoint flight
families crossing the archipelago, different phases and gliding heights. The
flock blends into garden refuges during rain and storms and is hidden once
sheltered; this is scenic behavior, not a species-specific ecological simulation.
Storm strikes end only on three decorative outcrops (lighthouse, ruin, grove),
outside every content island; their small local light and sound have no effect
on the editorial content. Reduced motion and reading suspend flashes.

## Preserved original version

The island and visitor are original procedural geometry authored for this project,
based on the chosen visual reference. Four curved, furnished pavilions represent
Especificar (terracotta), Gerar (sage), Validar (slate blue) and Evoluir (sand/olive).
The mesh and poster come from the same retained Blender scene. The visitor uses
an original articulated rig and the literal in-place clips `Idle` and `Walk`.

## Rebuild

1. Run `python scripts/world/prepare_textures.py` (Pillow required).
2. Use official Blender 4.5.14 LTS portable with `--background --factory-startup --python scripts/world/build_world.py -- --skip-render`.
3. Render `assets/world/island.blend` with `--python scripts/world/render_world.py`.
   Add `--cycles` for CPU rendering, or `--preview` for the smaller QA render.
4. Run `python scripts/world/finish_poster.py` to create the shipped WebP.
5. Run `python scripts/world/verify_assets.py`.

The Blender archive was downloaded from the official stable release directory:
https://download.blender.org/release/Blender4.5/blender-4.5.14-windows-x64.zip
Published 2026-09-15. SHA256 checked against the official `.sha256` file:
`b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9`.
It lives in `.sites-runtime/tools/blender/` and is not a public website asset.

## Texture provenance

Poly Haven sources, all CC0. Original 1K diffuse and OpenGL normal maps are
retained in `textures/source/`. The script derives compressed, tinted 512-pixel
plaster/wood maps and a 1024-pixel paving map for web delivery. Textures are
embedded inside GLB files; there are no remote texture dependencies.

- White Plaster 02 — Rob Tuytel: https://polyhaven.com/a/white_plaster_02
- Oak Veneer 01 — Jenelle van Heerden: https://polyhaven.com/a/oak_veneer_01
- Stone Tiles 02 — Charlotte Baglioni: https://polyhaven.com/a/stone_tiles_02
- Poly Haven licence: https://polyhaven.com/license

## Runtime coordinates

All runtime coordinates are metres, Y-up, with the visitor facing +Z and feet
rooted at zero. The main island pavement is Y≈0.04; pavilion floors are Y≈0.62.
The graph includes actual approaches and stair treads. The centre garden is
avoided by every authored route. Hit targets are the four real pavilion meshes.
`ambientNodes` refers only to separately pivoted tree canopies. Small rotations
can be applied around those local origins without moving a path or a building.
The exported GLBs omit the poster-only shadow ground, lights and camera. Both
world versions use native Draco compression; the Three.js bundled decoder is
self-hosted in `/experience/world/draco/`. The visitor uses ordinary uncompressed
glTF skinning for broad compatibility. The camera FOV is explicitly vertical in
both Blender and the manifest, and poster points are its normalized projections.

`build-report.json` and `verification.json` record measured sizes and structural
checks. Visual fidelity is assessed from the retained render and the runtime,
not inferred from these checks alone.
