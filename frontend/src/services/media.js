export async function loadReferenceMedia(path) {
  const clips = { 'demo:squat': 'squat.mp4', 'demo:toetouch': 'toetouch.mp4' };
  if (!clips[path]) throw new Error('Only bundled exercise demonstrations are available.');
  return import.meta.env.BASE_URL + 'demo/' + clips[path];
}

