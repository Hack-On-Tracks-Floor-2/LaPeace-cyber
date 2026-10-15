import { useEffect, useState } from 'react';

export const ROUTES = ['overview', 'assessment', 'library', 'findings', 'repairs', 'reports', 'settings'];

function parse() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path = '', param = ''] = raw.split('/');
  const route = ROUTES.includes(path) ? path : 'overview';
  return { route, param: param || null };
}

export function navigate(to) {
  const clean = String(to).replace(/^#\/?/, '');
  if (window.location.hash !== '#/' + clean) window.location.hash = '#/' + clean;
}

export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const onChange = () => setState(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return state;
}
