// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";

interface FeedbackButtonProps {
    turnId: string;
    question: string;
    answer: string;
    conversationId?: string;
}

export const FeedbackButton = ({
    turnId,
    question,
    answer,
    conversationId,
}: FeedbackButtonProps) => {
    const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
        "idle"
    );




    const handleFeedback = async (
        feedbackType: "positive" | "negative"
    ) => {
        if (status === "sent" || status === "loading") return;

        setStatus("loading");

        const conversationLink = conversationId
            ? `${window.location.origin}/chat/${conversationId}`
            : window.location.href;
        const feedbackLabel =
            feedbackType === "positive"
                ? "Feedback positif"
                : "Réponse signalée comme incomplète";
        const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
</head>

<body style="
  font-family:system-ui,-apple-system,sans-serif;
  color:#111827;
  max-width:700px;
  margin:0 auto;
  padding:32px 24px;
  background:#ffffff;
">

  <div style="
    border-left:4px solid ${feedbackType === "positive" ? "#22c55e" : "#ef4444"
            };
    padding:6px 16px;
    margin-bottom:28px;
  ">
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;">
      ${feedbackLabel}
    </h2>

    <p style="
      margin:0;
      color:#6b7280;
      font-size:13px;
    ">
      MonRAG · Feedback utilisateur ·
      ${new Date().toLocaleString("fr-FR")}
    </p>
  </div>

  <table style="
    width:100%;
    border-collapse:collapse;
    font-size:14px;
    margin-bottom:24px;
  ">
    <tr>
      <td style="
        padding:6px 16px 6px 0;
        color:#6b7280;
        width:160px;
      ">
        Type
      </td>

      <td style="padding:6px 0;">
        ${feedbackLabel}
      </td>
    </tr>

    <tr>
      <td style="
        padding:6px 16px 6px 0;
        color:#6b7280;
      ">
        Turn ID
      </td>

      <td style="padding:6px 0;">
        ${turnId}
      </td>
    </tr>
  </table>

  <div style="
    background:#f0f9ff;
    border:1px solid #bae6fd;
    border-radius:8px;
    padding:16px;
    margin-bottom:20px;
  ">
    <p style="
      margin:0 0 10px;
      font-size:12px;
      font-weight:600;
      text-transform:uppercase;
      color:#0369a1;
    ">
      Question posée
    </p>

    <p style="
      margin:0;
      font-size:15px;
      line-height:1.6;
    ">
      ${question}
    </p>
  </div>

  <div style="
    background:#f9fafb;
    border:1px solid #e5e7eb;
    border-radius:8px;
    padding:16px;
    margin-bottom:20px;
  ">
    <p style="
      margin:0 0 10px;
      font-size:12px;
      font-weight:600;
      text-transform:uppercase;
      color:#4b5563;
    ">
      Réponse du chatbot
    </p>

    <p style="
      margin:0;
      font-size:14px;
      line-height:1.7;
      white-space:pre-wrap;
    ">
      ${answer}
    </p>
  </div>

  <div style="
    background:#fafafa;
    border:1px solid #e5e7eb;
    border-radius:8px;
    padding:16px;
    margin-bottom:20px;
  ">
    <p style="
      margin:0 0 10px;
      font-size:12px;
      font-weight:600;
      text-transform:uppercase;
      color:#6b7280;
    ">
      Conversation
    </p>

    <a
      href="${conversationLink}"
      target="_blank"
      style="
        color:#2563eb;
        text-decoration:none;
      "
    >
      Ouvrir la conversation ↗
    </a>
  </div>

  <hr style="
    border:none;
    border-top:1px solid #e5e7eb;
    margin:24px 0;
  ">

  <p style="
    color:#9ca3af;
    font-size:12px;
    margin:0;
  ">
    Email envoyé automatiquement depuis MonRAG.
  </p>

</body>
</html>
`;

        const body = {
            to: "ezzouhairimeryem@gmail.com",
            subject:
                feedbackType === "positive"
                    ? "MonRAG - Feedback positif"
                    : "MonRAG - Réponse incomplète signalée",

            body: htmlBody,
        };

        try {
            const res = await fetch("/api/v1/notifications/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error("Network error");

            setStatus("sent");
        } catch {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };
    const label =
        status === "loading"
            ? "Envoi..."
            : status === "sent"
                ? "Signalé ✓"
                : status === "error"
                    ? "Erreur, réessayer"
                    : "Signaler réponse incomplète";

    return (
        <div className="feedback-actions">
            <button
                className={`feedback-button feedback-button--${status}`}
                onClick={() => handleFeedback("positive")}
                disabled={status === "loading" || status === "sent"}
                title={status === "idle" ? "Réponse utile" : label}
                aria-label={status === "idle" ? "Réponse utile" : label}
            >
                {status === "sent" ? (
                    <>
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M3 8l3.5 3.5L13 4.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                    </>
                ) : (
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M10 22H6V10h4v12Zm10-11a2 2 0 0 0-2-2h-6l1-4v-.5A1.5 1.5 0 0 0 11.5 3L6 8.5V20a2 2 0 0 0 2 2h8a2 2 0 0 0 1.84-1.22l2-5A2 2 0 0 0 20 15v-4Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>

            <button
                className={`feedback-button feedback-button--${status}`}
                onClick={() => handleFeedback("negative")}
                disabled={status === "loading" || status === "sent"}
                title={status === "idle" ? "Réponse non utile" : label}
                aria-label={status === "idle" ? "Réponse non utile" : label}
            >
                {status === "sent" ? (
                    <>
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M3 8l3.5 3.5L13 4.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                    </>
                ) : (
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M14 2h4v12h-4V2ZM4 13a2 2 0 0 0 2 2h6l-1 4v.5A1.5 1.5 0 0 0 12.5 21l5.5-5.5V4a2 2 0 0 0-2-2H8a2 2 0 0 0-1.84 1.22l-2 5A2 2 0 0 0 4 9v4Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
            </button>
        </div>
    );
};