// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./BotMessage.scss";

import { CopyButton } from "@intel-enterprise-rag-ui/components";
import { ChatBotIcon, ErrorIcon } from "@intel-enterprise-rag-ui/icons";
import { Markdown } from "@intel-enterprise-rag-ui/markdown";
import { sanitizeString } from "@intel-enterprise-rag-ui/utils";
import classNames from "classnames";
import { memo } from "react";

import {
  PlaySpeechButton,
  PlaySpeechButtonState,
} from "@/components/conversation-feed/PlaySpeechButton/PlaySpeechButton";
import { PulsingDot } from "@/components/conversation-feed/PulsingDot/PulsingDot";
import { SourcesGrid } from "@/components/sources/SourcesGrid/SourcesGrid";
import { FeedbackButton } from "@/components/conversation-feed/FeedbackButton/FeedbackButton";
import { ChatTurn } from "@/types";
import { BugReportButton } from "../BugReportButton/BugReportButton";

type BotMessageProps = Pick<
  ChatTurn,
  "id" | "answer" | "error" | "isPending" | "sources"
> & {
  question?: string;           // ← new: needed for the feedback email
  conversationId?: string;     // ← new: link to conversation
  playingState?: PlaySpeechButtonState;
  onFileDownload: (fileName: string, bucketName: string) => void;
  onPlayMessage?: (turnId: string) => Promise<void>;
};

const BotMessage = ({
  id,
  answer,
  error,
  isPending,
  sources,
  question = "",
  conversationId,
  playingState = "idle",
  onFileDownload,
  onPlayMessage,
}: BotMessageProps) => {
  const isWaitingForAnswer = isPending && (answer === "" || error !== null);
  const sanitizedAnswer = sanitizeString(answer);
  const showActions = !isPending && (sanitizedAnswer !== "" || error !== null);
  const showSources = showActions && Array.isArray(sources);

  const botResponse =
    error !== null ? (
      <div className="bot-message__error">
        <ErrorIcon />
        <p>{error}</p>
      </div>
    ) : (
      <div className="bot-message__text" data-testid="bot-message__text">
        <Markdown text={sanitizedAnswer} />
        {showActions && (
          <footer className="bot-message__footer">
            <CopyButton textToCopy={sanitizedAnswer} />
            {onPlayMessage && (
              <PlaySpeechButton
                turnId={id}
                playingState={playingState}
                onPlayMessage={onPlayMessage}
              />
            )}
            {/* Feedback button — right next to Copy */}
            <FeedbackButton
              turnId={id}
              question={question}
              answer={sanitizedAnswer}
              conversationId={conversationId}
            />
             <BugReportButton
              turnId={id}
              conversationId={conversationId}
              question={question}
              answer={sanitizedAnswer}
            />
          </footer>
        )}
        {showSources && (
          <SourcesGrid sources={sources} onFileDownload={onFileDownload} />
        )}
      </div>
    );

  const className = classNames("bot-message", {
    "bot-message--waiting": isWaitingForAnswer,
    "bot-message--completed": !isWaitingForAnswer,
  });

  return (
    <div className={className} data-testid={`bot-message-${id}`}>
      <ChatBotIcon className="bot-message__chat-bot-icon" />
      {isWaitingForAnswer ? <PulsingDot /> : botResponse}
    </div>
  );
};

export const MemoizedBotMessage = memo(BotMessage);