import React from 'react';

export default function AccountShell({ title, description, children, onNavigate, wide = false }) {
  return (
    <main className="icon-center account-shell">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <div className="account-logo-row">
          <button type="button" onClick={() => onNavigate?.('landing')} className="account-home-link" aria-label="ReMember home">
            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="account-logo"
            />
          </button>
        </div>
        <section className="surface-large account-panel" aria-label={title}>
          <header className="mb-7">
            <h1 className="heading-large sm:text-3xl">{title}</h1>
            <p className="text-intro leading-relaxed">{description}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
