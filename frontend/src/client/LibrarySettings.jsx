import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { ALL_EXERCISES, INSTRUCTIONS } from '../data';
import ReferenceVideo from '../components/ReferenceVideo';
import AiExerciseDrafts from './AiExerciseDrafts';
import KnowledgeExerciseChat from './KnowledgeExerciseChat';
import CareConnection from '../components/CareConnection';
import SideArmRaiseDemo from '../components/SideArmRaiseDemo';
import Icon from '../components/Icon';
const ExerciseAnimationPreview = lazy(() => import('../components/ExerciseAnimationPreview'));

export function ClientLibrary() {
  const { workspace } = useRecords();
  const [tab, setTab] = useState('browse');
  const [selected, setSelected] = useState('Side Arm Raise');
  const reference = workspace.references.find(item => item.exerciseName === selected && item.status === 'approved');
  return <>
    <header className="exercise-studio-hero"><div><span className="eyebrow">EXERCISE STUDIO</span><h1>Make every movement clear.</h1><p>Build a demonstration, create source-grounded guidance, and review it before it reaches a patient.</p></div><span className="studio-hero-mark" aria-hidden="true"><Icon name="workout" size={76} /></span></header>
    <div className="studio-tabs" role="group" aria-label="Exercise tools">{[['browse', 'workout', 'Movement studio', 'Preview & adjust'], ['generate', 'plan', 'Create a guide', 'Source-grounded AI']].map(([key, icon, title, subtitle]) => <button key={key} type="button" className={tab === key ? 'selected' : ''} aria-pressed={tab === key} onClick={() => setTab(key)}><Icon name={icon} size={24} /><span><b>{title}</b><small>{subtitle}</small></span></button>)}</div>
    {tab === 'browse' ? <div className="movement-workspace"><section className="card movement-brief"><span className="eyebrow">01 / CHOOSE YOUR MOVEMENT</span><h2>What are we practising?</h2><div className="movement-picker" role="group" aria-label="Preview exercise">{ALL_EXERCISES.map(exercise => <button type="button" key={exercise} aria-pressed={selected === exercise} className={selected === exercise ? 'selected' : ''} onClick={() => setSelected(exercise)}><Icon name="workout" size={21} /><span><b>{exercise}</b><small>{exercise === 'Side Arm Raise' ? 'Shoulders · front view · 3D preview' : exercise === 'Squat' ? 'Lower body · side view · 3D preview' : 'Mobility · side view · video reference'}</small></span><span aria-hidden="true">→</span></button>)}</div>
      <h3>Movement cues</h3><ol className="movement-timeline">{(INSTRUCTIONS[selected] ?? []).map(([title, text]) => <li key={title}><b>{title}</b><p>{text}</p></li>)}</ol>
      <div className="session-status">{reference ? 'A bundled reference is available. Set patient targets from their assignment page.' : 'Preview available for review. Patient assignment requires an approved reference; this preview does not create one.'}</div>
      <Link className="btn" to="/client/patients">Open patients to assign</Link>
    </section><section className="card movement-viewer"><div className="row sp"><span className="eyebrow">02 / REFINE THE DEMONSTRATION</span><span className="tag">{selected === 'Toe Touch' ? 'Reference video' : 'Interactive 3D'}</span></div>
      {selected === 'Side Arm Raise' ? <SideArmRaiseDemo studio /> : selected === 'Squat' ? <Suspense fallback={<p>Loading preview…</p>}><ExerciseAnimationPreview descriptor={{ id: 'mini-squat-illustration-v1', exercise_id: 'EX-KU-000001', knee_range_degrees: [30, 45] }} /></Suspense> : reference ? <div className="vid"><ReferenceVideo key={reference.versionId} mediaPath={reference.mediaPath} /></div> : <p>No reference video is available.</p>}
      {reference && selected !== 'Toe Touch' && <details className="source-review"><summary>Watch bundled reference</summary><div className="vid"><ReferenceVideo key={reference.versionId} mediaPath={reference.mediaPath} /></div></details>}
    </section></div> : <><KnowledgeExerciseChat /><details className="card"><summary>Advanced: saved drafts from your own reference notes</summary><AiExerciseDrafts /></details></>}
  </>;
}
export function ClientSettings() {
  const { user } = useAuth();
  return <><h1>Clinician settings</h1><div className="card"><b>{user.displayName}</b><p>{user.email}</p><p className="mut">Self-registered clinician · Professional credentials not verified</p></div><CareConnection /></>;
}

