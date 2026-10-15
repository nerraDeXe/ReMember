import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AccountShell({ title, description, children, onNavigate, wide = false }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10 sm:py-14">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="mb-7 flex justify-center">
          <button type="button" onClick={() => onNavigate?.('landing')} className="inline-flex items-center gap-2.5 text-slate-900" aria-label="ReMember home">
            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="h-24 w-auto object-contain"
            />
          </button>
        </div>
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm" aria-label={title}>
          <header className="mb-7">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{description}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
