"""Small integrity checks that must reject corrupt metadata and unsafe resume state."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from validate_knowledge_base import ROOT, validate


class KnowledgeBaseChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='kb-test-', dir=ROOT.parent)
        self.root = Path(self.temp.name) / 'knowledge-base'
        shutil.copytree(ROOT, self.root)

    def tearDown(self):
        target = Path(self.temp.name).resolve()
        self.assertTrue(target.is_relative_to(ROOT.parent.resolve()))
        self.assertTrue(target.name.startswith('kb-test-'))
        self.temp.cleanup()

    def mutate(self, path, change):
        target = self.root / path
        value = json.loads(target.read_text(encoding='utf-8'))
        change(value)
        target.write_text(json.dumps(value), encoding='utf-8')

    def test_initialized_structure(self):
        self.assertEqual(validate(self.root)['chapters'], 25)

    def test_pending_chapter_does_not_need_empty_collection(self):
        path = self.root / 'chapters/chapter-01/knowledge-units.jsonl'
        path.unlink(missing_ok=True)
        self.assertEqual(validate(self.root)['knowledge_units'], 32)

    def test_populated_collection_cannot_disappear(self):
        (self.root / 'chapters/chapter-22/knowledge-units.jsonl').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing extracted chapter collection'):
            validate(self.root)

    def test_stale_manifest_is_rejected(self):
        self.mutate('manifest.json', lambda value: value['counts'].update(knowledge_units=1))
        with self.assertRaisesRegex(ValueError, 'Manifest counts'):
            validate(self.root)

    def test_missing_outline_parent_is_rejected(self):
        self.mutate('structure/book-hierarchy.json', lambda value: value['nodes'][0].update(parent_id='MISSING'))
        with self.assertRaisesRegex(ValueError, 'Missing outline parent'):
            validate(self.root)

    def test_unreviewed_chapter_cannot_be_complete(self):
        (self.root / 'chapters/chapter-01/knowledge-units.jsonl').write_text('', encoding='utf-8')
        self.mutate('chapters/chapter-01/extraction-report.json', lambda value: value.update(completion_status='complete'))
        with self.assertRaisesRegex(ValueError, 'Incomplete chapter marked complete'):
            validate(self.root)

    def test_invalid_resume_section_is_rejected(self):
        self.mutate('manifest.json', lambda value: value['resume'].update(section_id='MISSING'))
        with self.assertRaisesRegex(ValueError, 'Invalid resume cursor'):
            validate(self.root)


if __name__ == '__main__':
    unittest.main()
