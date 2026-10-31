"""Validate knowledge-base structure, unit schemas, source pages and ID references.

Requires jsonschema. This detects structural errors, not clinical accuracy.
"""
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1] / 'knowledge-base'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def lines(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(root=ROOT):
    # Parse every JSON/JSONL, including metadata outside the current extraction batch.
    for path in root.rglob('*.json'):
        read(path)
    for path in root.rglob('*.jsonl'):
        lines(path)
    manifest = read(root / 'manifest.json')
    metadata = read(root / 'book-metadata.json')
    require(manifest['source_sha256'] == metadata['source']['sha256'], 'Source hash mismatch')
    hierarchy = read(root / 'structure/book-hierarchy.json')['nodes']
    node_ids = [n['id'] for n in hierarchy]
    require(len(node_ids) == len(set(node_ids)), 'Duplicate outline ID')
    nodes = {n['id']: n for n in hierarchy}
    parents = {manifest['book_id'], *node_ids}
    page_map = read(root / 'structure/page-map.json')
    require([p['pdf_page_number'] for p in page_map] == list(range(1, metadata['source']['pdf_page_count'] + 1)), 'Invalid page map')
    for node in hierarchy:
        require(node['parent_id'] in parents, f"Missing outline parent: {node['id']}")
        require(1 <= node['pdf_start_page'] <= len(page_map), f"Invalid outline page: {node['id']}")
        if node['parent_id'] in nodes:
            require(nodes[node['parent_id']]['level'] < node['level'], f"Invalid outline nesting: {node['id']}")
    schema = read(root / 'schemas/knowledge-unit.schema.json')
    Draft202012Validator.check_schema(schema)
    unit_validator = Draft202012Validator(schema)
    units, chapter_ids = {}, []
    total_pending = []
    for folder in sorted((root / 'chapters').glob('chapter-*')):
        chapter = read(folder / 'chapter-metadata.json')
        report = read(folder / 'extraction-report.json')
        chapter_id = chapter['chapter_id']
        chapter_ids.append(chapter_id)
        require(chapter_id in nodes, f'Missing chapter outline: {chapter_id}')
        require(1 <= chapter['pdf_start_page'] <= chapter['pdf_end_page'] <= len(page_map), f'Invalid chapter range: {chapter_id}')
        for section in chapter['section_ids']:
            require(section in nodes and nodes[section]['chapter_number'] == chapter['chapter_number'], f'Invalid chapter section: {section}')
        unit_path = folder / 'knowledge-units.jsonl'
        if not unit_path.exists():
            require(report['knowledge_units_created'] == 0 and report['completion_status'] == 'pending', f'Missing extracted chapter collection: {chapter_id}')
        collection = lines(unit_path) if unit_path.exists() else []
        require(report['knowledge_units_created'] == len(collection), f'Incorrect audit count: {chapter_id}')
        for unit in collection:
            unit_validator.validate(unit)
            uid = unit['id']
            require(uid not in units, f'Duplicate unit: {uid}')
            require(uid.startswith(f"KU-{chapter_id.replace('-', '')}-"), f'Wrong unit chapter ID: {uid}')
            citation = unit['chapter_metadata']
            require(citation['chapter_number'] == chapter['chapter_number'], f'Wrong citation chapter: {uid}')
            require(citation['chapter_title'] == chapter['chapter_title'], f'Wrong citation title: {uid}')
            require(citation['section_title'] in {nodes[s]['title'] for s in chapter['section_ids']}, f'Unknown source section: {uid}')
            pages = citation['pdf_page_numbers']
            require(all(chapter['pdf_start_page'] <= p <= chapter['pdf_end_page'] for p in pages), f'Citation outside chapter: {uid}')
            require(sorted(citation['printed_page_numbers']) == sorted(page_map[p - 1]['printed_page_number'] for p in pages), f'Printed/PDF citation mismatch: {uid}')
            units[uid] = unit
        for section in report['sections_processed']:
            require(section in chapter['section_ids'], f'Unknown reviewed section: {section}')
        require(report['completion_status'] in ['pending', 'partial', 'pending_review', 'complete'], f'Invalid audit status: {chapter_id}')
        if report['completion_status'] == 'complete':
            require(set(report['sections_processed']) == set(chapter['section_ids']), f'Incomplete chapter marked complete: {chapter_id}')
            require(not report['items_requiring_review'] and not report['unreadable_content'], f'Unresolved chapter marked complete: {chapter_id}')
        else:
            total_pending.append(chapter['chapter_number'])
        next_number = manifest['next_ids']['knowledge_units_by_chapter'][chapter_id]
        require(next_number > max((int(u['id'].rsplit('-', 1)[1]) for u in collection), default=0), f'Unit allocator would reuse IDs: {chapter_id}')
    require(chapter_ids == [f'CH-{i:02d}' for i in range(1, 26)], 'Missing chapters')
    relationships = lines(root / 'relationships/relationships.jsonl')
    exercises = lines(root / 'exercises/exercise-knowledge.jsonl')
    clusters = read(root / 'clusters/cluster-catalog.json')['clusters']
    for collection, key in [(relationships, 'relationship_id'), (exercises, 'exercise_id'), (clusters, 'cluster_id')]:
        ids = [item[key] for item in collection]
        require(len(ids) == len(set(ids)), f'Duplicate {key}')
    exercise_ids = {e['exercise_id'] for e in exercises}
    exercise_validator = Draft202012Validator(read(root / 'schemas/exercise.schema.json'))
    for exercise in exercises:
        exercise_validator.validate(exercise)
        eid = exercise['exercise_id']
        require(set(exercise['related_knowledge_units']) <= units.keys(), f'Dangling exercise evidence: {eid}')
        citation = exercise['source_reference']
        chapter = read(root / f"chapters/chapter-{citation['chapter']:02d}/chapter-metadata.json")
        require(all(chapter['pdf_start_page'] <= p <= chapter['pdf_end_page'] for p in citation['pdf_pages']), f'Exercise citation outside chapter: {eid}')
        require(sorted(citation['pages']) == sorted(page_map[p-1]['printed_page_number'] for p in citation['pdf_pages']), f'Exercise page mismatch: {eid}')
        phases = exercise['movement_phases']
        require(len({p['phase_id'] for p in phases}) == len(phases), f'Duplicate phase ID: {eid}')
        for phase in phases:
            require(set(phase['evidence_unit_ids']) <= set(exercise['related_knowledge_units']), f'Unknown phase evidence: {eid}')
        for refs in exercise['field_provenance'].values():
            require(bool(refs) and set(refs) <= set(exercise['related_knowledge_units']), f'Unknown field provenance: {eid}')
        for param in exercise['source_parameters']:
            require(param['minimum'] <= param['maximum'], f'Invalid source range: {eid}')
            require(set(param['evidence_unit_ids']) <= set(exercise['related_knowledge_units']), f'Unknown source-parameter evidence: {eid}')
        if exercise['animation']['render_ready']:
            require(exercise['clinical_approval']['status'] == 'approved', f'Unreviewed exercise marked renderable: {eid}')
            require(bool(exercise['animation']['motion_template_id']) and bool(exercise['animation']['rig_profile_id']), f'Renderable exercise lacks motion binding: {eid}')
    for uid, unit in units.items():
        require(set(unit['related_knowledge_units']) <= units.keys(), f'Dangling unit link: {uid}')
        require(set(unit['related_exercises']) <= exercise_ids, f'Dangling exercise link: {uid}')
    for relationship in relationships:
        require(relationship['source_id'] in units and relationship['target_id'] in units, 'Dangling relationship endpoint')
        require(bool(relationship.get('evidence')) and bool(relationship.get('source_reference', {}).get('pages')), 'Relationship lacks evidence or pages')
    for item in exercises + clusters:
        refs = item.get('related_knowledge_units', item.get('included_knowledge_units', []))
        require(set(refs) <= units.keys(), 'Dangling exercise/cluster unit reference')
    counts = {'parts': sum(n['kind'] == 'part' for n in hierarchy), 'chapters': len(chapter_ids),
              'outline_nodes': len(hierarchy), 'knowledge_units': len(units), 'relationships': len(relationships),
              'exercises': len(exercises), 'clusters': len(clusters)}
    require(manifest['counts'] == counts, 'Manifest counts are stale')
    require(manifest['resume']['section_id'] in nodes, 'Invalid resume cursor')
    require(nodes[manifest['resume']['section_id']]['chapter_number'] == int(manifest['resume']['chapter_id'].split('-')[1]), 'Resume chapter mismatch')
    audit = read(root / 'validation/extraction-audit.json')
    require(audit['chapters_pending'] == total_pending and audit['knowledge_units_total'] == len(units), 'Global audit is stale')
    chapter_index = read(root / 'retrieval/chapter-index.json')['entries']
    require(set(chapter_index) == set(chapter_ids), 'Chapter index mismatch')
    for cid, entry in chapter_index.items():
        require((root / entry['metadata_path']).is_file(), f'Missing indexed metadata: {cid}')
        require(set(entry['knowledge_unit_ids']) == {u['id'] for u in units.values() if u['chapter_metadata']['chapter_number'] == int(cid.split('-')[1])}, f'Stale chapter index: {cid}')
    for name in ['keyword', 'entity', 'cluster']:
        index = read(root / f'retrieval/{name}-index.json')['entries']
        for ids in index.values():
            require(set(ids) <= units.keys(), f'Dangling {name} index')
    exercise_index = read(root / 'retrieval/exercise-index.json')['entries']
    require({eid for ids in exercise_index.values() for eid in ids} == exercise_ids, 'Exercise index incomplete or dangling')
    relationship_ids = {r['relationship_id'] for r in relationships}
    for uid,ids in read(root / 'retrieval/relationship-index.json')['entries'].items():
        require(uid in units and set(ids) <= relationship_ids, 'Dangling relationship index')
    signatures = [' '.join(u['detailed_content'].casefold().split()) for u in units.values()]
    require(len(signatures)==len(set(signatures)), 'Duplicate canonical unit content')
    return counts


if __name__ == '__main__':
    print(json.dumps({'status': 'passed', 'counts': validate(), 'scope': 'structural validation; clinical fidelity requires source review'}, indent=2))
