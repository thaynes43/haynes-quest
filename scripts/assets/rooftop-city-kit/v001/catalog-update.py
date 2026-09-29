"""Refresh only Rooftop inventory entries and factual global counts after intake/rebase."""
import json,hashlib,re
from pathlib import Path

ROOT=Path('docs/assets/media/rooftop-city-kit/v001')
IDS={'water-tower':'Rooftop City water tower','rooftop-ac-unit':'Rooftop City AC unit',
     'crane-hook':'Rooftop City crane hook','billboard-frame':'Rooftop City billboard frame'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p=Path('scripts/assets/catalog-inventory.json');inventory=json.loads(p.read_text())
existing={e['id'] for e in inventory['assets']};added=sum(i not in existing for i in IDS)
inventory['assets']=[e for e in inventory['assets'] if e['id'] not in IDS]
for id,title in IDS.items():
    models=[str(ROOT/(id+'.glb'))]
    images=[str(ROOT/'stills'/f'{id}-{view}.png') for view in ('beauty','front','side','back','threequarter')]
    sources=models+images+[str(ROOT/f) for f in ('reference-sheet.png','source.json','provenance.json','visual-review.json',
        'validation.json','reimport.json','three-inspection.json','rooftop-city-kit.blend','sha256-manifest.json','final-verification.json') if (ROOT/f).exists()]
    inventory['assets'].append({'id':id,'title':title,'category':'family-eras',
        'review':f'docs/assets/reviews/rooftop-city-kit/v001.md#{id}',
        'concept_images':[str(ROOT/'reference-sheet.png')],'model_images':images,'models':models,'audio':[],
        'thumbnail':None,'version':'v001','state':"completed static model candidate from coordinator-approved Blender reference sheet; Awaiting Tom's review · used in the family release; replaces the existing Hero City scenery stand-in",
        'gameplay_use':'private-candidate','checksums':{s:sha(Path(s)) for s in sorted(sources)}})
for k in ('entries','model_entries','model_files','completed_model_candidates'):inventory['counts'][k]+=added
p.write_text(json.dumps(inventory,indent=2,ensure_ascii=False)+'\n')
for file in ('tests/game/playtest-artwork-contract.test.ts','tests/e2e/visual-catalog.mjs'):
    p=Path(file);s=p.read_text()
    for k,v in inventory['counts'].items():s=re.sub(r'(?m)^(\s*'+k+r': )\d+,',lambda m:m[1]+str(v)+',',s)
    if file.endswith('visual-catalog.mjs'):
        manifest=Path('docs/assets/media/catalog-thumbnails/v001/manifest.json')
        if manifest.exists():
            total=len(json.loads(manifest.read_text())['files'])
            s=re.sub(r'const expectedThumbnailFiles = \d+;',f'const expectedThumbnailFiles = {total};',s)
    p.write_text(s)
p=Path('docs/assets/catalog.md');s=p.read_text()
s=re.sub(r'\*\*\d+ completed models',f'**{inventory["counts"]["completed_model_candidates"]} completed models',s)
s=s.replace('The five remaining Hero City, Big Stage and Casino bonus models are registered for the pending v5 templates; the live v4 journeys still show placeholder art in those slots until the checked release is published.',
 'The exact Hero City, Big Stage and Casino bonus models are registered in v5. Their owner review remains open; the current release and remaining acceptance gates are recorded in the playtest guide.')
p.write_text(s)
print(json.dumps({'entries_added':added,'counts':inventory['counts']}))
