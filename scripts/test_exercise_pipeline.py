import copy
import unittest
from unittest.mock import patch

from jsonschema import ValidationError
from knowledge_base import prepare_context, validate_plan
from validate_knowledge_base import validate


def blocked_plan(context):
    return {'status':'needs_review','exercise_id':context['selection']['exercise_id'],
            'motion_template_id':None,'rig_profile_id':None,'phase_ids':[], 'parameters':[],
            'claims':[],'missing_requirements':['Motion asset and clinical review are pending.'],'questions':[]}


class ExercisePipelineChecks(unittest.TestCase):
    def test_full_structure_with_populated_data(self):
        self.assertEqual(validate()['exercises'],8)
        self.assertEqual(validate()['knowledge_units'],32)

    def test_mini_squat_resolves_and_retrieves_its_evidence(self):
        context=prepare_context('Show me a mini-squat')
        self.assertEqual(context['exercise']['slug'],'bilateral-mini-squat')
        retrieved={u['id'] for u in context['knowledge_units']}
        self.assertTrue(set(context['exercise']['related_knowledge_units'])<=retrieved)
        self.assertFalse(context['animation_capabilities']['render_ready'])

    def test_specific_external_rotation_alias(self):
        context=prepare_context('standing shoulder external rotation')
        self.assertEqual(context['exercise']['slug'],'standing-band-shoulder-external-rotation')

    def test_full_can_does_not_become_frontal_arm_raise(self):
        self.assertEqual(prepare_context('full-can scaption')['exercise']['slug'],'standing-full-can-scaption')
        self.assertIsNone(prepare_context('bilateral side arm raise')['exercise'])

    def test_unsupported_variations_do_not_fall_through(self):
        for query in ['deep squat','single leg bridge','weighted mini squat','marching bridge','empty can','seated heel raise','sitting band external rotation','band external rotation without band']:
            with self.subTest(query=query):
                context=prepare_context(query)
                self.assertIsNone(context['exercise'])
                self.assertFalse(context['animation_capabilities']['render_ready'])

    def test_toe_touch_is_not_substituted(self):
        self.assertIsNone(prepare_context('standing toe touch')['exercise'])

    def test_two_exercises_need_clarification(self):
        self.assertEqual(prepare_context('mini squat or wall squat')['selection']['status'],'needs_clarification')

    def test_step_phase_contractions_are_source_backed(self):
        phases=prepare_context('forward step up')['exercise']['movement_phases']
        self.assertEqual(phases[0]['contraction_types'],['concentric'])
        self.assertEqual(phases[1]['contraction_types'],['eccentric'])
        self.assertTrue(all(p['evidence_unit_ids'] for p in phases))

    def test_missing_muscle_phases_stay_empty(self):
        exercise=prepare_context('mini squat')['exercise']
        self.assertTrue(all(not p['contraction_types'] for p in exercise['movement_phases']))

    def test_scapular_plane_angle_is_not_an_elevation_target(self):
        param=prepare_context('full can')['exercise']['source_parameters'][0]
        self.assertEqual(param['name'],'scapular_plane_anterior_orientation')
        self.assertIn('not humeral elevation',param['scope'])

    def test_review_response_is_accepted_without_rendering(self):
        context=prepare_context('mini squat')
        self.assertFalse(validate_plan(blocked_plan(context),context)['render_allowed'])

    def test_missing_asset_cannot_be_rendered(self):
        context=prepare_context('mini squat')
        plan=blocked_plan(context)
        plan.update(status='ready_to_render',motion_template_id='invented',rig_profile_id='invented',phase_ids=[p['phase_id'] for p in context['exercise']['movement_phases']],missing_requirements=[])
        with self.assertRaisesRegex(ValueError,'Rendering blocked'):
            validate_plan(plan,context)

    def test_fabricated_citations_are_rejected(self):
        context=prepare_context('mini squat')
        plan=blocked_plan(context)
        plan['claims']=[{'text':'Unsupported claim','evidence_unit_ids':['KU-CH21-9999']}]
        with self.assertRaisesRegex(ValueError,'retrieved knowledge'):
            validate_plan(plan,context)

    def test_arbitrary_animation_code_is_rejected(self):
        context=prepare_context('bridge')
        plan=blocked_plan(context)
        plan['blender_python']='arbitrary code'
        with self.assertRaises(ValidationError):
            validate_plan(plan,context)

    def test_unknown_phase_is_rejected(self):
        context=prepare_context('bridge')
        plan=blocked_plan(context)
        plan['phase_ids']=['invented-phase']
        with self.assertRaisesRegex(ValueError,'unknown exercise phase'):
            validate_plan(plan,context)

    def test_generated_parameters_cannot_hide_in_review_response(self):
        context=prepare_context('bridge')
        plan=blocked_plan(context)
        plan['parameters']=[{'name':'hip_angle','value':123,'provenance':'reviewed_template','reference_id':'fake'}]
        with self.assertRaisesRegex(ValueError,'Non-renderable plans'):
            validate_plan(plan,context)

    def test_unknown_exercise_cannot_claim_resolved_id(self):
        context=prepare_context('toe touch')
        plan=blocked_plan(context)
        plan['exercise_id']='EX-KU-000001'
        with self.assertRaisesRegex(ValueError,'differs from resolved'):
            validate_plan(plan,context)

    def test_invalid_query_is_rejected(self):
        with self.assertRaises(ValueError):
            prepare_context('')

    def test_render_gate_uses_current_assets_bounds_and_parameter_authority(self):
        # Synthetic, in-memory assets exercise the gate; not textbook or production motion data.
        context=prepare_context('mini squat')
        exercise=copy.deepcopy(context['exercise'])
        exercise['clinical_approval']['status']='approved'
        phases=[p['phase_id'] for p in exercise['movement_phases']]
        template={'motion_template_id':'TEST-ONLY','exercise_id':exercise['exercise_id'],
                  'review_status':'approved','rig_profile_id':'TEST-RIG','phase_ids':phases,
                  'parameters':{'test_parameter':{'minimum':1,'maximum':10}}}
        context['exercise']=exercise
        context['animation_capabilities']={'render_ready':True,'blockers':[],'reviewed_templates':[template]}
        context['authorized_parameter_values']={'test_parameter':{'value':2,'provenance':'user_request','reference_id':'TEST-REQUEST'}}
        plan=blocked_plan(context)
        plan.update(status='ready_to_render',motion_template_id='TEST-ONLY',rig_profile_id='TEST-RIG',phase_ids=phases,missing_requirements=[],
                    parameters=[{'name':'test_parameter','value':2,'provenance':'user_request','reference_id':'TEST-REQUEST'}])
        fake_files={'animation/motion-registry.json':{'templates':[template]},
                    'animation/rig-profiles.json':{'profiles':[{'rig_profile_id':'TEST-RIG','review_status':'approved'}]}}
        from knowledge_base import read as original_read
        def fake_read(path,root):
            return fake_files[path] if path in fake_files else original_read(path,root)
        with patch('knowledge_base.read',side_effect=fake_read), patch('knowledge_base.collection',return_value=[exercise]):
            self.assertTrue(validate_plan(plan,context)['render_allowed'])
            plan['parameters'][0]['value']=20
            with self.assertRaisesRegex(ValueError,'outside reviewed bounds'):
                validate_plan(plan,context)
            plan['parameters'][0]['value']=3
            with self.assertRaisesRegex(ValueError,'not authorized'):
                validate_plan(plan,context)
            plan['parameters'][0]['value']=2
            template['review_status']='revoked'
            with self.assertRaisesRegex(ValueError,'Unknown template'):
                validate_plan(plan,context)


if __name__=='__main__':
    unittest.main()
