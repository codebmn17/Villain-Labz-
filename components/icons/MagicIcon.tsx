import React from 'react';

export const MagicIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 8.049l1.414 1.414m4.486 4.486l1.414 1.414M14.951 8.049l-1.414 1.414m-4.486 4.486L7.636 12.5" />
        <path d="M12 21a9 9 0 01-9-9" opacity="0.4" />
        <path d="M3 12a9 9 0 019-9" opacity="0.4" />
    </svg>
);
