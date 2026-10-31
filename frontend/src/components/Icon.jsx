const paths = {
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  home:   <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>,
  plan:   <><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/></>,
  prog:   <path d="M3 20h18M6 16v-5M11 16V6M16 16v-8"/>,
  fb:     <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>,
  me:     <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
  workout: <><circle cx="14" cy="4.5" r="2"/><path d="M5 21l4-8 3 2 3-4M9 13l-2-4 5-2 3 3 3 1"/></>,
  info:   <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></>,
  bell:   <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
  call:   <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>,
  cal:    <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  clock:  <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
};

export default function Icon({ name, size = 24, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"
      style={{ width: size, height: size, stroke: color, fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
}
