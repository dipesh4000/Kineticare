import { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { ALL_EXERCISES, VIDEO_ONLY_EXERCISES } from '../data';
import { useRecords } from '../records/recordsContext';
import ReferenceVideo from '../components/ReferenceVideo';
import ReferenceCapture from './ReferenceCapture';

export function ClientLibrary() {
  const { workspace } = useRecords();
  const [captureExercise, setCaptureExercise] = useState(null);

  if (captureExercise) return <ReferenceCapture exerciseName={captureExercise} onClose={() => setCaptureExercise(null)} />;

  return (
    <>
      <h1>Exercise library</h1>
      <p className="mut">Three camera-measured protocols. References become assignable only after capture and explicit approval.</p>
      <div className="grid">
        {ALL_EXERCISES.map(exercise => {
          const videoOnly = VIDEO_ONLY_EXERCISES.includes(exercise);
          const references = workspace.references.filter(reference => reference.exerciseName === exercise && reference.status === 'approved');
          return <div key={exercise} className="card">
            <h3>{exercise}</h3>
            <p className="mut">{videoOnly ? 'Video guide only. Not measured by the camera.' : exercise === 'Side Arm Raise' ? 'Front camera view' : 'Side camera view'}</p>
            <span className={`tag ${references.length ? 'ok' : 'warn'}`}>{references.length ? `${references.length} approved version${references.length === 1 ? '' : 's'}` : 'Reference required'}</span>
            {!videoOnly && <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => setCaptureExercise(exercise)}>Capture new reference</button></div>}
            {references.slice(0, 1).map(reference => <div key={reference.versionId} style={{ marginTop: 12 }}>
              <b>Latest: version {reference.version}</b>
              {reference.demo
                ? <p className="mut">Demo clip supplied by the team. Targets are set per patient in the assignment.</p>
                : <p className="mut">{reference.targetExcursionDeg}° median movement · {(reference.targetDurationMs / 1000).toFixed(1)}s median tempo</p>}
              <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div>
            </div>)}
          </div>;
        })}
      </div>
    </>
  );
}

export function ClientSettings() {
  const { user, firebaseEnabled } = useAuth();
  return (
    <>
      <h1>Settings</h1>
      <div className="card">
        <b>{user.displayName}</b>
        <p className="mut">Clinician account · {firebaseEnabled ? 'Firebase workspace' : 'Local demo workspace'}</p>
      </div>
      <div className="card">
        <h3>Clinical status</h3>
        <p className="mut">Exercise targets, cue wording, and prototype scoring require physiotherapist review before any real-patient use.</p>
      </div>
    </>
  );
}
