import React from 'react';

export default function AccountShell({ title, description, children, onNavigate, wide = false }) {
  return (
    <main className="account-shell-main">
      <div className={`account-shell-content ${wide ? "account-shell-wide" : "account-shell-narrow"}`}>
        <div className="account-shell-brand">
          <button type="button" onClick={() => onNavigate?.('landing')} className="account-shell-home-link" aria-label="ReMember home">
            <img
              src="/remember-logo.png"
              alt="ReMember"
              className="account-shell-logo"
            />
          </button>
        </div>
        <section className="account-shell-card" aria-label={title}>
          <header className="account-shell-header">
            <h1 className="account-shell-title">{title}</h1>
            <p className="account-shell-description">{description}</p>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
