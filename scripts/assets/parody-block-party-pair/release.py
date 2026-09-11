"""Reap this work order's completed workers and durably release the live scene.

Run in the leased live Blender instance, after final media have been inspected.
This never stops a running job or touches a preceding work order's checkpoint.
"""
from datetime import datetime, timezone
from pathlib import Path
import bpy, hashlib, json

BASE=Path('/workspace/haynes-quest/parody/block-party-pair/v001')

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,data):path.write_text(json.dumps(data,indent=2)+'\n')

def main():
    registry=bpy.app.driver_namespace['wo028_jobs']
    assert registry and all(j['process'].poll() is not None for j in registry.values()),'Owned workers remain active'
    assert all(j['process'].returncode==0 for j in registry.values()),'An owned worker failed'
    jobs=[]
    for name,job in registry.items():
        process=job['process'];code=process.wait(timeout=0)
        handle=job.get('log_handle')
        if handle is not None and not handle.closed:handle.close()
        jobs.append({'name':name,'pid':process.pid,'command':job.get('command',process.args),
                     'started_unix':job.get('started_unix'),'exit_code':code,
                     'wait_completed':True,'reaped':True,'had_retained_log_handle':handle is not None,
                     'retained_log_handle_closed':handle is None or handle.closed})
    lease=json.loads((BASE/'scene-lease.json').read_text())
    previous=lease['previous_release'];path=Path(previous['path'])
    assert path.stat().st_size==previous['bytes'] and digest(path)==previous['sha256'],'Preceding checkpoint changed'
    final=BASE/'live-scene-release.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(final))
    released=datetime.now(timezone.utc).isoformat()
    completed={'work_order':'WO-028','recorded_utc':released,'all_owned_jobs_exited_and_reaped':True,
               'jobs':jobs,'owned_process_count':len(jobs),
               'note':'Popen.poll and wait return the exited child status; wait completed for every retained owned process. Synchronous validation/encoding subprocesses also completed before their callers returned.'}
    write(BASE/'render-process-completion.json',completed)
    lease.update({'state':'released','released_utc':released,'previous_release_unchanged':True,
                  'final_live_scene':{'path':str(final),'bytes':final.stat().st_size,'sha256':digest(final)},
                  'owned_processes_exited_and_reaped':True,'owned_process_count':len(jobs)})
    write(BASE/'scene-lease.json',lease)
    print(json.dumps({'state':lease['state'],'released_utc':released,'owned_processes':len(jobs),'final_scene':lease['final_live_scene']}))

if __name__=='__main__':main()
