import { useEffect, useState } from 'react';
import { loadReferenceMedia } from '../services/media';

export default function ReferenceVideo({ mediaPath }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let currentUrl = '';
    let cancelled = false;
    if (!mediaPath) return undefined;
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

  if (error) return <p className="demo" role="alert">{error}</p>;
  if (!url) return <p className="mut">Loading reference video…</p>;
  return <video controls playsInline src={url} style={{ width: '100%', borderRadius: 14 }} />;
}
