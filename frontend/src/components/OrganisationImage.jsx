import React, { useEffect, useState } from 'react';
import { Building2, Image as ImageIcon } from 'lucide-react';

export default function OrganisationImage({ src, kind = 'logo', alt, className = '', imageClassName = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const Icon = kind === 'banner' ? ImageIcon : Building2;
  return (
    <div className={`bg-slate-100 text-slate-400 overflow-hidden ${className}`}>
      {src && !failed ? (
        <img src={src} alt={alt || `Organisation ${kind}`} onError={() => setFailed(true)} className={`w-full h-full ${kind === 'logo' ? 'object-contain' : 'object-cover'} ${imageClassName}`} />
      ) : (
        <div role="img" aria-label={`No ${kind} image`} className="w-full h-full flex items-center justify-center">
          <Icon aria-hidden="true" className={kind === 'banner' ? 'w-10 h-10' : 'w-6 h-6'} />
        </div>
      )}
    </div>
  );
}
