"""Attach verified local WebGL evidence after exact remote artifact collection.

Run only after the author has inspected all exact views and motion grids. Remote
manifests remain the transport record; local manifests add this final intake.
"""
import argparse
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path

ASSETS=('loop-dancer','prism-mimic','trendweaver')

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def finalize(repo):
 repo=Path(repo);summary={}
 for name in ASSETS:
  folder=repo/'docs/assets/media'/name/'v001';manifest_path=folder/'manifest.json'
  manifest=json.loads(manifest_path.read_text());browser=json.loads((folder/'browser-inspection.json').read_text());three=json.loads((folder/'three-inspection.json').read_text())
  current=digest(folder/(name+'.glb'));assert current==manifest['glb_sha256']==browser['glb_sha256']==three['glb_sha256']
  assert all(browser['checks'].values()) and all(three['checks'].values())
  for item in manifest['files']:
   source=(repo/'test-results/era-2024-masters'/name if item['role']=='editable_master' else folder)/item['local_name']
   assert source.is_file() and source.stat().st_size==item['bytes'] and digest(source)==item['sha256'],source
  manifest['review']['creator_inspection']={'selected_concept':True,'exact_glb_front_side_back_beauty':True,'five_clip_motion_grid':True,'software_webgl_raster':True,'date_utc':datetime.now(timezone.utc).isoformat()}
  manifest['review']['coordinator_selection']='Root selected the final shapes for first-pass packaging; integrated game/studio intake remains root-owned.'
  manifest['validation']['browser']={'version':browser['browser'],'renderer':browser['renderer'],'checks':browser['checks'],'report':'browser-inspection.json','limitations':browser['limitations']}
  floor=min(a['bounds']['min'][1] for a in three['animations'].values())
  manifest['runtime']['minimum_sampled_animated_height_m']=floor
  manifest['runtime']['rig_bones_including_fixed_root']=len(three['bones'])
  manifest['local_intake']={'source':'Exact downloaded GLB in an isolated Chromium process with embedded texture uploads and four distinct raster samples per clip','integrated_gameplay':False,'physical_safari':False,'files':[]}
  for filename in ('browser-beauty.png','browser-attack.png','browser-inspection.json'):
   path=folder/filename
   manifest['local_intake']['files'].append({'repository_path':path.relative_to(repo).as_posix(),'bytes':path.stat().st_size,'sha256':digest(path)})
  local_sources={'scripts/assets/era-2024/browser-intake.mjs','scripts/assets/era-2024/finalize-local.py'}
  manifest['sources']=[entry for entry in manifest['sources'] if entry.get('repository_path') not in local_sources]
  for filename in ('browser-intake.mjs','finalize-local.py'):
   source=repo/'scripts/assets/era-2024'/filename
   manifest['sources'].append({'repository_path':source.relative_to(repo).as_posix(),'sha256':digest(source),'execution':'Local dev-env; no live Blender scene access'})
  manifest['limitations']=[entry for entry in manifest['limitations'] if not entry.startswith('Small sampled sole penetration')]
  manifest['limitations'].append('Small sampled sole penetration remains: %.3f mm; collision/movement are external to the GLB.'%max(0,-floor*1000))
  manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
  summary[name]={'glb_sha256':current,'manifest_sha256':digest(manifest_path),'browser_checks':browser['checks'],'all_transport_file_hashes_verified':True}
 target=repo/'scripts/assets/era-2024/local-finalization.json';target.write_text(json.dumps(summary,indent=2)+'\n')
 print(json.dumps(summary))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--repo',default='.')
 args=parser.parse_args();finalize(args.repo)
