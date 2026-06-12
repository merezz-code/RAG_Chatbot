// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from "react";
import "./BugReportButton.scss";

interface BugReportButtonProps {
    turnId: string;
    conversationId?: string;
    question: string;
    answer: string;
}

type Status = "idle" | "loading" | "sent" | "error";

export const BugReportButton = ({
    turnId,
    conversationId,
    question,
    answer,
}: BugReportButtonProps) => {
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const dialogRef = useRef<HTMLDialogElement>(null);

    const openModal = () => {
        setOpen(true);
        setDescription("");
        setStatus("idle");
        // Use dialog element for focus-trap + a11y
        requestAnimationFrame(() => dialogRef.current?.showModal());
    };

    const closeModal = () => {
        dialogRef.current?.close();
        setOpen(false);
    };

    const handleSubmit = async () => {
        if (!description.trim() || status === "loading") return;

        setStatus("loading");
        try {
            const res = await fetch("/api/v1/bugs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    turnId,
                    conversationId,
                    question,
                    answer,
                    description: description.trim(),
                    // Browser metadata auto-collected by backend via User-Agent header,
                    // but we can add window.location for completeness:
                    pageUrl: window.location.href,
                }),
            });
            if (!res.ok) throw new Error("Bug report failed");
            setStatus("sent");
        } catch {
            setStatus("error");
        }
    };

    return (
        <>
            <button
                className="action-button"
                onClick={openModal}
                title="Signaler un bug"
                aria-label="Signaler un bug"
            >
                {/* Bug icon */}
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-bug" viewBox="0 0 16 16">
  <path d="M4.355.522a.5.5 0 0 1 .623.333l.291.956A5 5 0 0 1 8 1c1.007 0 1.946.298 2.731.811l.29-.956a.5.5 0 1 1 .957.29l-.41 1.352A5 5 0 0 1 13 6h.5a.5.5 0 0 0 .5-.5V5a.5.5 0 0 1 1 0v.5A1.5 1.5 0 0 1 13.5 7H13v1h1.5a.5.5 0 0 1 0 1H13v1h.5a1.5 1.5 0 0 1 1.5 1.5v.5a.5.5 0 1 1-1 0v-.5a.5.5 0 0 0-.5-.5H13a5 5 0 0 1-10 0h-.5a.5.5 0 0 0-.5.5v.5a.5.5 0 1 1-1 0v-.5A1.5 1.5 0 0 1 2.5 10H3V9H1.5a.5.5 0 0 1 0-1H3V7h-.5A1.5 1.5 0 0 1 1 5.5V5a.5.5 0 0 1 1 0v.5a.5.5 0 0 0 .5.5H3c0-1.364.547-2.601 1.432-3.503l-.41-1.352a.5.5 0 0 1 .333-.623M4 7v4a4 4 0 0 0 3.5 3.97V7zm4.5 0v7.97A4 4 0 0 0 12 11V7zM12 6a4 4 0 0 0-1.334-2.982A3.98 3.98 0 0 0 8 2a3.98 3.98 0 0 0-2.667 1.018A4 4 0 0 0 4 6z"/>
</svg>
            </button>

            {open && (
                <dialog
                    ref={dialogRef}
                    className="bug-modal"
                    onClose={closeModal}
                    aria-labelledby="bug-modal-title"
                >
                    <div className="bug-modal__header">
                        <h2 id="bug-modal-title" className="bug-modal__title">
                            Signaler un bug
                        </h2>
                        <button
                            className="bug-modal__close"
                            onClick={closeModal}
                            aria-label="Fermer"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                        </button>
                    </div>

                    {status === "sent" ? (
                        <div className="bug-modal__success">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M7 12l3.5 3.5L17 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <p>Bug signalé. Merci pour votre retour&nbsp;!</p>
                        </div>
                    ) : (
                        <>
                            <div className="bug-modal__context">
                                <p className="bug-modal__label">Question</p>
                                <p className="bug-modal__excerpt">{question.slice(0, 120)}{question.length > 120 ? "…" : ""}</p>
                            </div>

                            <label className="bug-modal__label" htmlFor="bug-description">
                                Décrivez le problème *
                            </label>
                            <textarea
                                id="bug-description"
                                className="bug-modal__textarea"
                                rows={4}
                                placeholder="La réponse est vide / incorrecte / incomplète…"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={status === "loading"}
                                autoFocus
                            />

                            {status === "error" && (
                                <p className="bug-modal__error-msg" role="alert">
                                    Erreur lors de l'envoi. Veuillez réessayer.
                                </p>
                            )}

                            <div className="bug-modal__footer">
                                <button className="bug-modal__btn bug-modal__btn--secondary" onClick={closeModal}>
                                    Annuler
                                </button>
                                <button
                                    className="bug-modal__btn bug-modal__btn--primary"
                                    onClick={handleSubmit}
                                    disabled={!description.trim() || status === "loading"}
                                >
                                    {status === "loading" ? "Envoi…" : "Envoyer le rapport"}
                                </button>
                            </div>
                        </>
                    )}
                </dialog>
            )}
        </>
    );
};