import React from 'react';

export const EqIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m-6-10v2M6 6v2m12-2v2m0 10v2M12 12h8m-8 0H4" />
    </svg>
);