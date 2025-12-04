import React from 'react';

export const OpenAIIcon: React.FC<{ className?: string }> = ({ className = "h-8 w-8 text-purple-400 mr-3" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.86 19.333l-5.46-3.153v-6.306l5.46-3.153 5.46 3.153v6.306l-5.46 3.153zm-6.86-3.853l-5.46-3.153v-6.306l5.46-3.153 5.46 3.153v6.306l-5.46 3.153z" opacity={0.4}/>
      <path d="M12 12.327l5.46-3.153-5.46-3.153-5.46 3.153 5.46 3.153zm-6.86 3.853l5.46 3.153v-6.306l-5.46-3.153v6.306zm13.72 0v-6.306l-5.46 3.153v6.306l5.46-3.153z"/>
    </svg>
);