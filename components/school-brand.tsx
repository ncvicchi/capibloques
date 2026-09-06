'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export type SchoolBrandData = { name: string; logoUrl: string | null };
export function SchoolIdentity({ name, logoUrl }: SchoolBrandData) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!name) return null;
  return <div className="school-identity">
    {logoUrl && failedUrl !== logoUrl && <Image unoptimized src={logoUrl} alt={`Logo de ${name}`} width={112} height={112} onError={() => setFailedUrl(logoUrl)} />}
    <strong>{name}</strong>
  </div>;
}

export default function SchoolBrand() {
  const [school, setSchool] = useState<SchoolBrandData | null>(null);
  useEffect(() => {
    let generation = 0;
    async function refresh() {
      const ticket = ++generation;
      try {
        const response = await fetch('/api/school/', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!response.ok) return;
        const data = await response.json() as SchoolBrandData;
        if (ticket === generation && typeof data.name === 'string' && (data.logoUrl === null || /^\/api\/school\/logo\/[a-f0-9]{64}\/$/.test(data.logoUrl))) setSchool(data);
      } catch { /* La marca no debe bloquear el formulario de ingreso. */ }
    }
    const focus = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => { ++generation; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return school ? <SchoolIdentity {...school} /> : null;
}
