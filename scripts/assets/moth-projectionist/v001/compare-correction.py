"""WO105: prove the corrected GLB differs only in documented scene metadata."""
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import struct
import sys

root = Path(sys.argv[1]).resolve()
previous = root / 'pre-WO105-metadata-correction'
sha = lambda data: hashlib.sha256(data).hexdigest()


def decode(path):
    data = path.read_bytes()
    assert struct.unpack_from('<III', data) == (0x46546C67, 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    binary_size, binary_kind = struct.unpack_from('<II', data, 20 + size)
    binary = data[28 + size:]
    assert binary_kind == 0x004E4942 and len(binary) == binary_size
    return data, json.loads(data[20:20 + size]), binary


old_bytes, old_json, old_binary = decode(previous / 'moth-projectionist.glb')
new_bytes, new_json, new_binary = decode(root / 'moth-projectionist.glb')
old_extra = old_json['scenes'][0]['extras']
new_extra = new_json['scenes'][0]['extras']
changes = {key: {'before': old_extra.get(key), 'after': new_extra.get(key)}
           for key in sorted(old_extra.keys() | new_extra.keys())
           if old_extra.get(key) != new_extra.get(key)}
old_structure, new_structure = deepcopy(old_json), deepcopy(new_json)
for structure in (old_structure, new_structure):
    for scene in structure['scenes']:
        scene.pop('extras', None)

old_three = json.loads((previous / 'three-inspection.json').read_text())
new_three = json.loads((root / 'three-inspection.json').read_text())
old_three.pop('glb_sha256')
new_three.pop('glb_sha256')
browser = json.loads((root / 'corrected-preview/browser-inspection.json').read_text())
validation = json.loads((root / 'validation.json').read_text())
raster_comparisons = []
for file in sorted((previous / 'final-preview').glob('*.png')):
    new_file = root / 'corrected-preview' / file.name
    old_hash, new_hash = sha(file.read_bytes()), sha(new_file.read_bytes())
    raster_comparisons.append({'path': file.name, 'original_sha256': old_hash,
                               'corrected_sha256': new_hash, 'identical': old_hash == new_hash})
checks = {
    'binary_chunk_byte_identical': old_binary == new_binary,
    'all_json_outside_scene_extras_identical': old_structure == new_structure,
    'only_expected_scene_extras_changed': set(changes) == {'candidate_status', 'scene_owner', 'correction_work_order'},
    'scene_metadata_identifies_wo103_moth': new_extra['work_order'] == 'WO103' and new_extra['candidate_status'].startswith('WO103 Moth Projectionist v001'),
    'all_three_measurements_identical': old_three == new_three,
    'all_previous_preview_rasters_identical': len(raster_comparisons) >= 50 and all(item['identical'] for item in raster_comparisons),
    'corrected_three_checks_pass': all(new_three['checks'].values()),
    'corrected_khronos_checks_pass': all(validation['checks'].values()),
    'corrected_browser_checks_pass': all(browser['checks'].values()),
}
record = {
    'work_order': 'WO105', 'asset_work_order': 'WO103', 'asset_id': 'moth-projectionist', 'version': 'v001',
    'created_utc': datetime.now(timezone.utc).isoformat(),
    'original_glb_sha256': sha(old_bytes), 'glb_sha256': sha(new_bytes),
    'original_bytes': len(old_bytes), 'corrected_bytes': len(new_bytes), 'byte_delta': len(new_bytes) - len(old_bytes),
    'original_blend_sha256': sha((previous / 'moth-projectionist.blend').read_bytes()),
    'corrected_blend_sha256': sha((root / 'moth-projectionist.blend').read_bytes()),
    'unchanged_binary_chunk_sha256': sha(new_binary), 'unchanged_binary_chunk_bytes': len(new_binary),
    'scene_extras_changes': changes,
    'semantic_scope': 'All mesh, skin, material, texture, accessor, node and animation JSON is identical; the complete binary payload is byte-identical. Only three scene extras change. The Blender master also embeds the corrected build source and the metadata re-export script.',
    'rest_bounds_y_up': new_three['rest_bounds_y_up'],
    'all_animation_bounds_y_up': new_three['all_animation_bounds_y_up'],
    'dimensions_m': new_three['dimensions_m'],
    'clip_durations_s': {key: value['duration_s'] for key, value in new_three['animations'].items()},
    'attack_contact_seconds': new_three['contact']['time_s'],
    'raster_comparisons': raster_comparisons, 'checks': checks,
    'immutable_input_local_root': str(previous),
    'immutable_input_remote_root': '/workspace/haynes-quest/rat-casino-cast/moth-projectionist/v001/pre-WO105-metadata-correction',
    'limits': ['Software Chromium WebGL only; no physical device acceptance.', 'Studio candidate; exact owner art review remains pending.'],
}
(root / 'metadata-correction.json').write_text(json.dumps(record, indent=2) + '\n')
failures = [key for key, value in checks.items() if not value]
print(json.dumps({'glb_sha256': record['glb_sha256'], 'byte_delta': record['byte_delta'], 'unchanged_rasters': sum(item['identical'] for item in raster_comparisons), 'raster_count': len(raster_comparisons), 'failures': failures}))
assert not failures, failures
