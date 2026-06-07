// src/components/LogFAB.tsx
// Floating Action Button + Log modal (desktop) / bottom sheet (mobile)
// Uses window.innerWidth check (client-side only) to decide layout.

import { useState, useEffect, useCallback } from 'react';
import SolveWizard from './SolveWizard';

interface Props {
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function LogFAB({ externalOpen, onExternalOpenHandled }: Props) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [closing, setClosing] = useState(false);
  const isMobile = useIsMobile();

  // Handle external open trigger (from mobile bottom tab bar)
  useEffect(() => {
    if (externalOpen && !isOpen) {
      setIsOpen(true);
      setClosing(false);
      onExternalOpenHandled?.();
    }
  }, [externalOpen]);

  const open = useCallback(() => { setIsOpen(true); setClosing(false); }, []);

  const close = useCallback(() => {
    if (isMobile) {
      setClosing(true);
      setTimeout(() => { setIsOpen(false); setClosing(false); }, 280);
    } else {
      setIsOpen(false);
    }
  }, [isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <>
      {/* FAB button — hidden when open */}
      {!isOpen && (
        <button
          className="fab"
          onClick={open}
          aria-label="Log a solve"
          title="Log a solve"
        >
          <i className="ti ti-plus" style={{ fontSize: '1.375rem' }} />
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 400,
            animation: 'fade-in 0.15s ease',
          }}
        />
      )}

      {/* ── DESKTOP: centered modal ──────────────────────────────── */}
      {isOpen && !isMobile && (
        <div
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', zIndex: 401, pointerEvents: 'none',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              display: 'flex', flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
              pointerEvents: 'all',
              animation: 'modal-slide-up 0.2s cubic-bezier(.175,.885,.32,1.1) both',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <i className="ti ti-edit" style={{ marginRight: 8, color: 'var(--accent)' }} />
                Log a Solve
              </span>
              <button
                onClick={close}
                aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
              >
                <i className="ti ti-x" style={{ fontSize: '0.9rem' }} />
              </button>
            </div>

            {/* Wizard content */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <SolveWizard onSuccess={close} />
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE: bottom sheet ─────────────────────────────────── */}
      {isOpen && isMobile && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: '85dvh',
            background: 'var(--bg-surface)',
            borderRadius: '20px 20px 0 0',
            zIndex: 401,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: closing
              ? 'sheet-slide-down 0.28s ease forwards'
              : 'sheet-slide-up 0.3s cubic-bezier(.175,.885,.32,1.05) both',
          }}
        >
          {/* Drag handle */}
          <div style={{ padding: '12px 0 4px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }} onClick={close}>
            <div style={{ width: 32, height: 4, background: 'var(--bg-surface-2)', borderRadius: 2 }} />
          </div>

          {/* Sheet header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 1.25rem 0.75rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <i className="ti ti-edit" style={{ marginRight: 8, color: 'var(--accent)' }} />
              Log a Solve
            </span>
            <button
              onClick={close}
              style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}
            >
              <i className="ti ti-x" />
            </button>
          </div>

          {/* Wizard content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <SolveWizard onSuccess={close} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sheet-slide-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes sheet-slide-down {
          from { transform: translateY(0); }
          to   { transform: translateY(100%); }
        }
      `}</style>
    </>
  );
}
