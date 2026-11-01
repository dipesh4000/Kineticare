import { useEffect, useState } from 'react';
import { loadReferenceMedia } from '../services/media';
import SideArmRaiseDemo from './SideArmRaiseDemo';

export default function ReferenceVideo({ mediaPath, loop = false, autoPlay = false, controls = true }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let currentUrl = '';
    let cancelled = false;
    if (!mediaPath || mediaPath === 'demo:armraise') return undefined;
    loadReferenceMedia(mediaPath).then(nextUrl => {
      if (cancelled) return URL.revokeObjectURL(nextUrl);
      currentUrl = nextUrl;
      setUrl(nextUrl);
    }).catch(() => setError('Reference video could not be loaded.'));
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [mediaPath]);

  if (mediaPath === 'demo:armraise') {
    return <SideArmRaiseDemo studio={false} />;
  }

  if (error) return <p className="demo" role="alert">{error}</p>;
  if (!url) return <p className="mut">Loading reference video…</p>;
  return <video controls={controls} loop={loop} autoPlay={autoPlay} muted={autoPlay} playsInline src={url} style={{ width: '100%', borderRadius: 14 }} />;
}
