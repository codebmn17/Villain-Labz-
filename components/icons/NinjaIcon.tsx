import React from 'react';

export const NinjaIcon: React.FC<{ className?: string }> = ({ className = "h-8 w-8 text-purple-400 mr-3" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M2.2 12H21.8"/>
        <path d="M10 16.5c.33-2.5 2-4.5 4-4.5"/>
        <path d="M15 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
    </svg>
);