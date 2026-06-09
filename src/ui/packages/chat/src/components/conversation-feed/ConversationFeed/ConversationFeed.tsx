// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./ConversationFeed.scss";

import classNames from "classnames";
import debounce from "lodash.debounce";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { MemoizedBotMessage as BotMessage } from "@/components/conversation-feed/BotMessage/BotMessage";
import { PlaySpeechButtonState } from "@/components/conversation-feed/PlaySpeechButton/PlaySpeechButton";
import { ScrollToBottomButton } from "@/components/conversation-feed/ScrollToBottomButton/ScrollToBottomButton";
import { MemoizedUserMessage as UserMessage } from "@/components/conversation-feed/UserMessage/UserMessage";
import { ChatTurn } from "@/types";

const bottomMargin = 80;

interface ConversationFeedProps {
  conversationTurns: ChatTurn[];
  conversationId?: string;      // ← new: passed down to FeedbackButton
  playingTurnId?: string | null;
  playingState?: PlaySpeechButtonState;
  onFileDownload: (fileName: string) => void;
  onPlayMessage?: (turnId: string) => Promise<void>;
}

export const ConversationFeed = ({
  conversationTurns,
  conversationId,
  playingTurnId,
  playingState,
  onFileDownload,
  onPlayMessage,
}: ConversationFeedProps) => {
  const conversationFeedRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottomBtn, setShowScrollToBottomBtn] = useState(false);
  const prevConversationLengthRef = useRef<number>(0);
  const pendingTurnRef = useRef<HTMLDivElement>(null);

  const debouncedScrollToBottom = useRef(
    debounce((behavior: ScrollBehavior) => {
      if (conversationFeedRef.current) {
        conversationFeedRef.current.scroll({
          behavior,
          top: conversationFeedRef.current.scrollHeight,
        });
      }
    }, 50),
  ).current;

  const debouncedScrollToBottomButtonUpdate = useRef(
    debounce(() => {
      if (conversationFeedRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          conversationFeedRef.current;
        const atBottom =
          scrollHeight - scrollTop <= clientHeight + bottomMargin;
        setShowScrollToBottomBtn(!atBottom);
      }
    }, 100),
  ).current;

  useEffect(() => {
    const currentLength = conversationTurns.length;
    const prevLength = prevConversationLengthRef.current;
    if (prevLength > 0 && currentLength > prevLength) {
      debouncedScrollToBottom("instant");
    }
    prevConversationLengthRef.current = currentLength;
  }, [conversationTurns.length, debouncedScrollToBottom]);

  useEffect(() => {
    if (conversationFeedRef.current) {
      debouncedScrollToBottomButtonUpdate();
    }
  }, [
    conversationFeedRef.current?.scrollHeight,
    conversationFeedRef.current?.scrollTop,
    conversationFeedRef.current?.clientHeight,
    debouncedScrollToBottomButtonUpdate,
  ]);

  useLayoutEffect(() => {
    const pendingTurn = conversationTurns.find((turn) => turn.isPending);
    const shouldApplyMargin = !!pendingTurn;

    const updatePendingTurnSpacing = () => {
      if (
        pendingTurnRef.current &&
        conversationFeedRef.current &&
        shouldApplyMargin
      ) {
        const feedClientHeight = conversationFeedRef.current.clientHeight;
        const pendingTurnHeight =
          pendingTurnRef.current.getBoundingClientRect().height;
        const BOT_MESSAGE_MARGIN_BOTTOM = 32;
        const marginBottom = Math.max(
          0,
          feedClientHeight - pendingTurnHeight - BOT_MESSAGE_MARGIN_BOTTOM,
        );
        pendingTurnRef.current.style.marginBottom = `${marginBottom}px`;
      }
    };

    updatePendingTurnSpacing();

    if (!shouldApplyMargin && conversationFeedRef.current) {
      const allTurns =
        conversationFeedRef.current.querySelectorAll(".conversation-turn");
      allTurns.forEach((turn) => {
        (turn as HTMLElement).style.marginBottom = "";
      });
    }

    if (!shouldApplyMargin) return;

    const resizeObserver = new ResizeObserver(updatePendingTurnSpacing);
    if (conversationFeedRef.current) {
      resizeObserver.observe(conversationFeedRef.current);
    }
    if (pendingTurnRef.current) {
      resizeObserver.observe(pendingTurnRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [conversationTurns]);

  useEffect(() => {
    return () => {
      debouncedScrollToBottom.cancel();
      debouncedScrollToBottomButtonUpdate.cancel();
    };
  }, [debouncedScrollToBottom, debouncedScrollToBottomButtonUpdate]);

  const handleScroll = useCallback(() => {
    debouncedScrollToBottomButtonUpdate();
  }, [debouncedScrollToBottomButtonUpdate]);

  return (
    <div className="conversation-feed__wrapper">
      <div
        ref={conversationFeedRef}
        className="conversation-feed__scroll"
        onScroll={handleScroll}
      >
        <div className="conversation-feed" data-testid="conversation-feed">
          {conversationTurns.map(
            ({ id, question, answer, error, isPending, sources }) => {
              const messagePlayingState: PlaySpeechButtonState =
                playingTurnId === id ? (playingState ?? "idle") : "idle";

              return (
                <div
                  key={id}
                  ref={isPending ? pendingTurnRef : null}
                  className={classNames("conversation-turn", {
                    "conversation-turn--pending": isPending,
                  })}
                >
                  <UserMessage id={id} question={question} />
                  <BotMessage
                    id={id}
                    answer={answer}
                    isPending={isPending}
                    error={error}
                    sources={sources}
                    question={question}              // ← passed for feedback
                    conversationId={conversationId} // ← passed for feedback link
                    onFileDownload={onFileDownload}
                    onPlayMessage={onPlayMessage}
                    playingState={messagePlayingState}
                  />
                </div>
              );
            },
          )}
        </div>
      </div>
      <ScrollToBottomButton
        show={showScrollToBottomBtn}
        onPress={() => debouncedScrollToBottom("smooth")}
      />
    </div>
  );
};