"""A single bounded CPU render job: 8 model views, one duo pose, one 13.8s reel.

All geometry and clips are re-imported from the final exact GLB bytes. The live
authoring scene is never modified by this separate, owned evidence process.
"""
from pathlib import Path
import bpy,hashlib,json,math,subprocess,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parent))
import render as R
ROOT=Path(__file__).resolve().parent
CLIPS=[('idle',2.4),('move',1.2),('attack',1.6),('hit',.6),('defeat',2.),('cheer',2.),('high-five',1.6),('dizzy',2.4)]

def contact_sheet(segments):
    frames=ROOT/'reel-frames'
    # A compact contact sheet makes every clip reviewable without playback.
    inputs=[]
    for segment in segments:inputs+=['-i',str(frames/('%04d.png'%segment['representative_frame']))]
    filters=[]
    for i,segment in enumerate(segments):filters.append('[%d:v]scale=360:280,drawtext=text=\'%s\':fontcolor=white:fontsize=20:box=1:boxcolor=black@0.6:x=10:y=10[v%d]'%(i,segment['clip'],i))
    filters.append(''.join('[v%d]'%i for i in range(8))+'xstack=inputs=8:layout=0_0|360_0|720_0|1080_0|0_280|360_280|720_280|1080_280[out]')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex',';'.join(filters),'-map','[out]','-frames:v','1',str(ROOT/'bestie-pink'/'joint-motion-grid.png')],check=True)

def main():
    started=time.time();records={}
    for name in ['bestie-pink','bestie-black']:
        folder=ROOT/name;R.clear();bpy.context.scene.render.fps=30;arm=R.load(folder/(name+'.glb'))
        cam=R.studio(1.4,width=800,height_px=900,samples=20);bpy.context.scene.render.fps=30
        views=[('beauty.png','idle',(3.08,7,2.8)),('front.png',None,(0,7,.71)),('side.png',None,(7,0,.71)),('back.png',None,(0,-7,.71))]
        for file,clip,position in views:
            R.set_pose(arm,clip,0);R.shot(folder/file,cam,position,(0,0,.71),1.80)
        R.set_pose(arm,'idle',0)
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'-export-review.blend')),compress=True)
        records[name]={'asset_id':name,'source':'exact reimported GLB','glb_sha256':hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest(),'views':[v[0] for v in views]}
    R.clear();bpy.context.scene.render.fps=30;arms=[]
    for name,x in [('bestie-pink',-.45),('bestie-black',.45)]:
        arm=R.load(ROOT/name/(name+'.glb'));arm.location.x=x;arms.append(arm)
    cam=R.studio(1.4,width=1050,height_px=750,samples=20);scene=bpy.context.scene;scene.render.fps=30
    for arm in arms:R.set_pose(arm,'high-five',30)
    R.shot(ROOT/'bestie-pink'/'joint-pose.png',cam,(.35,7,2.45),(0,0,.73),2.35)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'joint-export-review.blend'),compress=True)
    # 10 rendered samples per second, preserving the real duration of every clip.
    scene.render.resolution_x=720;scene.render.resolution_y=560;scene.cycles.samples=4
    cam.location=(.55,7,2.50);cam.rotation_euler=(R.Vector((0,0,.72))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.35
    frames=ROOT/'reel-frames';frames.mkdir(exist_ok=True);index=0;segments=[]
    for clip,duration in CLIPS:
        start=index/10
        for i in range(round(duration*10)):
            for arm in arms:R.set_pose(arm,clip,i*3)
            scene.render.filepath=str(frames/('%04d.png'%index));bpy.ops.render.render(write_still=True);index+=1
        segments.append({'clip':clip,'start_s':start,'duration_s':duration,'frames':round(duration*10),'representative_frame':index-round(duration*10)+min(round(duration*10)-1,10 if clip in ('attack','high-five') else round(duration*10*(.95 if clip=='defeat' else .23 if clip=='hit' else .25)))})
    # Labels identify the exact authored clips, with no audio or injected motion.
    labels=','.join("drawtext=text='%s':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.60:boxborderw=9:x=18:y=18:enable='between(t,%s,%s)'"%(s['clip'],s['start_s'],s['start_s']+s['duration_s']-.001) for s in segments)
    video=ROOT/'bestie-pink'/'joint-animations.mp4'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','10','-i',str(frames/'%04d.png'),'-vf',labels+',fps=30','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(video)],check=True)
    contact_sheet(segments)
    for name,record in records.items():
        record.update({'joint_pose':'bestie-pink/joint-pose.png','joint_reel':'bestie-pink/joint-animations.mp4','joint_motion_grid':'bestie-pink/joint-motion-grid.png','joint_reel_native_render_fps':10,'joint_reel_encoded_fps':30,'segments':segments,'all_clip_geometry':'both independently skinned exact exports','completed_unix':time.time()})
        (ROOT/name/'render-complete.json').write_text(json.dumps(record,indent=2)+'\n')
    (ROOT/'evidence-complete.json').write_text(json.dumps({'completed':True,'rendered_animation_frames':index,'elapsed_s':time.time()-started,'assets':records},indent=2)+'\n')
    print(json.dumps({'completed':True,'frames':index,'elapsed_s':time.time()-started}),flush=True)

if __name__=='__main__':main()
