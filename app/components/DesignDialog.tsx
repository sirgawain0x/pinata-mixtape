"use client";

import { useModalStatus } from "@privy-io/react-auth";
import { ReactNode, useEffect, useId, useRef } from "react";

export default function DesignDialog({ title, onClose, children, className = "" }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { isOpen: privyModalOpen } = useModalStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (privyModalOpen) { dialog?.close(); return; }
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [privyModalOpen]);
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className={`mt-dialog ${className}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mt-dialog-content">
        <header className="mt-dialog-heading"><h2 id={titleId}>{title}</h2>
          <button type="button" className="mt-close" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
