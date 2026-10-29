import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingState({ message = 'Loading catalog...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
