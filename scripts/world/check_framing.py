"""Measure the actual outer circular perimeter projected by camera variants."""
import bpy,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
scene=bpy.context.scene;camera=scene.camera
scene.render.resolution_x=1600;scene.render.resolution_y=1200
for fov in [32,33,34]:
    for target_y in [1.1,.5,0,-.5,-1.0]:
        camera.data.sensor_fit="VERTICAL"
        camera.data.lens=camera.data.sensor_height/(2*math.tan(math.radians(fov)/2))
        target=Vector((0,0,target_y))
        camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
        bpy.context.view_layer.update()
        points=[Vector((10*math.cos(i*math.tau/180),10*math.sin(i*math.tau/180),-.56)) for i in range(180)]
        points.extend(Vector((x,y,z)) for x,y,z in [(-7.1,6.3,4.1),(8.2,2,4.2),(-4.8,6.65,3.6),(4.8,6.65,3.6),(-4.8,-2.1,3.6),(4.8,-2.1,3.8)])
        projected=[world_to_camera_view(scene,camera,v) for v in points]
        print("FRAME",fov,target_y,"x",round(min(p.x for p in projected),4),round(max(p.x for p in projected),4),"y",round(min(1-p.y for p in projected),4),round(max(1-p.y for p in projected),4),flush=True)
