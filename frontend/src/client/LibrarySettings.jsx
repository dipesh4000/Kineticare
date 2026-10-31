import { useAuth } from '../auth/authContext';
import { useRecords } from '../records/recordsContext';
import { ALL_EXERCISES, INSTRUCTIONS } from '../data';
import ReferenceVideo from '../components/ReferenceVideo';
import AiExerciseDrafts from './AiExerciseDrafts';
import CareConnection from '../components/CareConnection';

export function ClientLibrary() {
  const { workspace } = useRecords();
  return <><h1>Exercise library</h1><p className="mut">Bundled exercise demonstrations and written instructions. Recording and uploads are not enabled.</p><AiExerciseDrafts /><div className="grid">{ALL_EXERCISES.map(exercise => {
    const reference = workspace.references.find(item => item.exerciseName === exercise);
    return <article className="card" key={exercise}><h3>{exercise}</h3>{reference ? <div className="vid"><ReferenceVideo mediaPath={reference.mediaPath} /></div> : <p className="mut">No bundled demonstration yet. This exercise cannot be newly assigned until a reference is available.</p>}{(INSTRUCTIONS[exercise] ?? []).map(([title, text]) => <p key={title}><b>{title}:</b> {text}</p>)}</article>;
  })}</div></>;
}
export function ClientSettings() {
  const { user } = useAuth();
  return <><h1>Clinician settings</h1><div className="card"><b>{user.displayName}</b><p>{user.email}</p><p className="mut">Self-registered clinician · Professional credentials not verified</p></div><CareConnection /></>;
}

