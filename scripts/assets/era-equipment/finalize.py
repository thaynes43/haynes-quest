"""Hash the concrete WO-017 review package after all technical intake passes."""
import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
MEDIA = REPO / 'docs/assets/media/era-equipment/v001'
NAMES = ['spark-mallet', 'acorn-shield', 'prism-wand', 'ribbon-shield']
COORDINATOR_REVIEW = 'selected for candidate catalog/intake by lead Astra on 2026-09-11'


def finalize():
    collection = json.loads(Path(__file__).with_name('collection-verification.json').read_text())
    result = {'schema_version': 1, 'work_order': 'WO-017', 'version': 'v001', 'author': 'native gpt-6-astra, max', 'candidate_status': 'unapproved', 'coordinator_review': COORDINATOR_REVIEW, 'tom_review': 'pending', 'asset_root': 'haynes-quest/era-equipment/v001', 'assets': {}}
    result['concept_references'] = {name: {'repository_path': str((MEDIA / name).relative_to(REPO)), 'sha256': hashlib.sha256((MEDIA / name).read_bytes()).hexdigest()} for name in ['starter-concept.png', 'later-concept.png']}
    result['scene_release'] = json.loads(Path(__file__).with_name('scene-release.json').read_text())
    result['render_job_completion'] = json.loads(Path(__file__).with_name('render-job-completion.json').read_text())
    assert result['render_job_completion']['all_render_records_complete'] and not result['render_job_completion']['running']
    result['shared_artifacts'] = [entry for entry in collection['files'] if '/' not in entry['file']]
    for name in NAMES:
        folder = MEDIA / name; construction = json.loads((folder / 'construction.json').read_text()); validation = json.loads((folder / 'validation.json').read_text()); reimport = json.loads((folder / 'reimport.json').read_text()); three = json.loads((folder / 'three-inspection.json').read_text())
        glb_hash = hashlib.sha256((folder / (name + '.glb')).read_bytes()).hexdigest()
        render = json.loads((folder / 'render-complete.json').read_text())
        assert render['all_complete'] and render['source_sha256'] == glb_hash
        assert glb_hash == construction['files'][name + '.glb']['sha256'] == validation['sha256'] == reimport['glb_sha256'] == three['glb_sha256']
        for report in [validation, reimport, three]: assert all(report['checks'].values()), (name, report['checks'])
        entries = []
        for file in sorted(folder.iterdir()):
            if file.name in ['manifest.json', 'quick.png', 'quick-back.png'] or not file.is_file(): continue
            data = file.read_bytes(); entries.append({'file': file.name, 'repository_path': str(file.relative_to(REPO)), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
        masters = [entry for entry in collection['files'] if entry['file'].startswith(name + '/') and entry['file'].endswith('.blend')]
        concept_name = 'starter-concept.png' if name in ['spark-mallet', 'acorn-shield'] else 'later-concept.png'
        record = {'asset_id': name, 'version': 'v001', 'candidate_status': 'unapproved', 'coordinator_review': COORDINATOR_REVIEW, 'tom_review': 'pending', 'concept_reference': result['concept_references'][concept_name], 'glb_sha256': glb_hash, 'glb_bytes': validation['bytes'], 'triangles': validation['triangles'], 'materials': len(validation['materials']), 'draw_primitives': validation['draw_primitives'], 'dimensions_gltf_m': validation['bounds_gltf']['dimensions'], 'attachment': construction['attachment'], 'editable_masters': masters, 'files': entries, 'limitations': three['limitations']}
        (folder / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n'); result['assets'][name] = record
    (MEDIA / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({name: {'triangles': data['triangles'], 'bytes': data['glb_bytes'], 'sha256': data['glb_sha256']} for name, data in result['assets'].items()}, indent=2))


if __name__ == '__main__': finalize()
