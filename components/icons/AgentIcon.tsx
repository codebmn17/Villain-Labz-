import React from 'react';

export const AgentIcon: React.FC<{ className?: string }> = ({ className = "h-10 w-10 text-purple-400" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 10.5A2.25 2.25 0 017.5 8.25h9a2.25 2.25 0 012.25 2.25v9.75a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25V10.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 10.5c0-1.13.434-2.163 1.166-2.967.732-.804 1.763-1.283 2.834-1.283h3.5c1.07 0 2.102.48 2.834 1.283.732.804 1.166 1.837 1.166 2.967m-12 0h12M15 13.5h-6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 16.5h.008v.008H7.5V16.5zm0-3h.008v.008H7.5V13.5zm3-3h.008v.008H10.5V10.5zm3 0h.008v.008H13.5V10.5zm3 3h.008v.008H16.5V13.5zm-3 3h.008v.008H13.5V16.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25V4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 4.5h4.5" />
    </svg>
);
