import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageMotion({ children, className = '' }) {
  const root = useRef(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.IntersectionObserver) return;
    const animations = [];
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        observer.unobserve(entry.target);
        animations.push(entry.target.animate([
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 420, delay: Math.min(index * 45, 180), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      });
    }, { threshold: 0.06 });
    root.current.querySelectorAll('.daily-focus, .page-heading, .card, .activity-module, .exercise-list, .care-priority, .quick-actions, .library-shortcut').forEach(element => observer.observe(element));
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [pathname]);
  return <div ref={root} className={`page-motion ${className}`} key={pathname}>{children}</div>;
}
