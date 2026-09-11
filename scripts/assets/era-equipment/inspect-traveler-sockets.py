"""Read existing traveler GLBs without Blender and derive honest rest sockets.

The exports have translation-only joints, except a tiny infant pelvis scale.
The original source defines a mitten center from wrist/forearm direction; that
point is useful for rigid gear. This records rest transforms, not a claimed
closed fist or combat pose. No traveler file is changed.
"""
import hashlib
import json
import math
from pathlib import Path
import struct

REPO = Path(__file__).resolve().parents[3]


def inspect():
    result = {'schema_version': 1, 'coordinate_system': '+Y up, forward -Z, meters', 'source': 'Existing exact traveler v001 GLB JSON and scripts/assets/travelers/build.py mitten-center formula', 'stages': {}}
    for stage, authored_scale in [('infant', .78), ('child', 1)]:
        path = REPO / f'docs/assets/media/traveler-{stage}/v001/traveler-{stage}.glb'
        data = path.read_bytes()
        gltf = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
        nodes = gltf['nodes']
        parents = {child: i for i, node in enumerate(nodes) for child in node.get('children', [])}
        def transform(i):
            node = nodes[i]
            assert 'matrix' not in node and node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1], node
            t = node.get('translation', [0, 0, 0]); s = node.get('scale', [1, 1, 1])
            if i in parents:
                pt, ps = transform(parents[i]); t = [pt[k] + ps[k] * t[k] for k in range(3)]; s = [ps[k] * s[k] for k in range(3)]
            return t, s
        by_name = {node.get('name'): i for i, node in enumerate(nodes)}
        stage_record = {'file': str(path.relative_to(REPO)), 'sha256': hashlib.sha256(data).hexdigest(), 'hands': {}}
        for side in ['L', 'R']:
            hand_id, forearm_id = by_name['hand.' + side], by_name['forearm.' + side]
            wrist, scale = transform(hand_id); elbow, _ = transform(forearm_id)
            delta = [wrist[k] - elbow[k] for k in range(3)]; length = math.sqrt(sum(v * v for v in delta))
            offset = [v / length * .027 * authored_scale for v in delta]
            offset[2] -= .009 * authored_scale
            local_offset = [offset[k] / scale[k] for k in range(3)]
            stage_record['hands'][side] = {
                'hand_bone': 'hand.' + side, 'forearm_bone': 'forearm.' + side,
                'three_loader_hand_name': 'hand' + side, 'three_loader_forearm_name': 'forearm' + side,
                'three_loader_authored_name_key': 'userData.name',
                'hand_node_index': hand_id, 'forearm_node_index': forearm_id,
                'wrist_rest_world_m': wrist, 'elbow_rest_world_m': elbow,
                'bone_rest_world_scale': scale, 'bone_rest_world_quaternion_xyzw': [0, 0, 0, 1],
                'bone_local_axes_at_rest': {'x': [1, 0, 0], 'y': [0, 1, 0], 'z': [0, 0, 1]},
                'suggested_grip_socket_local_m': local_offset,
                'suggested_grip_socket_rest_world_m': [wrist[k] + offset[k] for k in range(3)],
                'socket_local_quaternion_xyzw': [0, 0, 0, 1],
                'method': 'Follow the hand bone; offset from wrist along forearm by 0.027 × authored stage scale, then 0.009 × stage scale toward -Z. This is the source mitten-center formula converted to glTF coordinates.',
            }
        result['stages'][stage] = stage_record
    result['three_loader_name_guidance'] = 'Verified with Three.js GLTFLoader 0.186.0 against both exact local traveler exports: hand.R becomes object.name handR, forearm.R becomes forearmR, with the original authored names retained as object.userData.name. Resolve the authored names through userData.name when attaching equipment; direct getObjectByName("hand.R") does not find the loaded hand.'
    result['limitations'] = ['Rest-space socket guidance only; existing mittens do not have articulated fingers.', 'Combat poses must be authored or applied to the traveler arms; existing interact is not a verified combat clip.', 'Do not attach to the avatar scene root or copy static world positions during animation.', 'Keep standard meter-scale equipment for both stages. Scale changes need explicit design and renewed placement checks.']
    output = Path(__file__).with_name('traveler-sockets.json')
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    inspect()
