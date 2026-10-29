import React, { useEffect, useState } from 'react';
import { Building2, Image as ImageIcon } from 'lucide-react';

export default function OrganisationImage({ src, kind = 'logo', alt, className = '', imageClassName = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const Icon = kind === 'banner' ? ImageIcon : Building2;
  return (
    <div className={`organisation-image ${className}`}>
      {src && !failed ? (
        <img src={src} alt={alt || `Organisation ${kind}`} onError={() => setFailed(true)} className={`organisation-image-content ${kind === 'logo' ? 'organisation-image-logo' : 'organisation-image-banner'} ${imageClassName}`} />
      ) : (
        <div role="img" aria-label={`No ${kind} image`} className="organisation-image-placeholder">
          <Icon aria-hidden="true" className={kind === 'banner' ? 'organisation-image-banner-icon' : 'organisation-image-logo-icon'} />
        </div>
      )}
    </div>
  );
}
