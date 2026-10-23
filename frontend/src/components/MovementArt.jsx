export default function MovementArt({ exercise = 'Side Arm Raise' }) {
  const squat = exercise.toLowerCase().includes('squat');
  const reach = exercise.toLowerCase().includes('toe');
  return <svg viewBox="0 0 200 180" className="movement-art" aria-hidden="true">
    <ellipse cx="100" cy="155" rx="69" ry="8" fill="currentColor" opacity=".08" />
    <circle cx="102" cy="89" r="69" fill="currentColor" opacity=".06" />
    <circle cx={reach ? 122 : 102} cy={squat ? 48 : 34} r="13" fill="#efb995" />
    <path d={squat ? 'M98 69L80 104L114 117L97 150M81 104L59 123L77 150' : reach ? 'M111 58L76 91L98 119L96 151M76 91L63 121L63 151' : 'M101 56L100 105L78 150M100 105L123 150'} stroke="#233343" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={squat ? 'M98 69L123 85L145 72' : reach ? 'M110 58L132 91L135 122' : 'M101 59L65 72L39 51M101 59L137 72L163 51'} stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={squat ? 'M98 66L83 91' : reach ? 'M109 57L87 80' : 'M101 56L100 88'} stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
    <path d="M39 26L43 20M158 116L166 118M150 29L157 35" stroke="currentColor" opacity=".35" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
