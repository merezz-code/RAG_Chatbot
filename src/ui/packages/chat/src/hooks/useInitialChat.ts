// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { sanitizeString } from "@intel-enterprise-rag-ui/utils";
import { ChangeEventHandler, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { ABORT_ERROR_MESSAGE } from "@/api/config";
import { UsePostPromptMutation } from "@/api/qna.api";
import {
  useChatStreaming,
  UseChatStreamingConfig,
} from "@/hooks/useChatStreaming";
import { ChatTurn } from "@/types";

export interface UseInitialChatConfig {
  usePostPromptMutation: UsePostPromptMutation;
  streamingConfig: UseChatStreamingConfig;
  isChatSideMenuOpen: boolean;
  onNavigateToChat?: (chatId: string) => void;
}

export const useInitialChat = (config: UseInitialChatConfig) => {
  const {
    usePostPromptMutation,
    streamingConfig,
    isChatSideMenuOpen,
    onNavigateToChat,
  } = config;

  // RTK Query hooks
  const [postPrompt] = usePostPromptMutation();

  // Streaming utilities
  const {
    resetStreamingRefs,
    createStreamingCallbacks,
    saveChatAndFetch,
    handleStreamingError,
  } = useChatStreaming({
    ...streamingConfig,
    onNavigateToChat,
  });

  // Local state for temporary chat
  const [userInput, setUserInput] = useState("");
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [isChatResponsePending, setIsChatResponsePending] = useState(false);

  // Internal AbortController management
  const abortControllerRef = useRef<AbortController | null>(null);

  const onRequestAbort = () => {
    if (!abortControllerRef.current) {
      return;
    }
    abortControllerRef.current.abort(ABORT_ERROR_MESSAGE);
    setIsChatResponsePending(false);
  };

  const onPromptChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    setUserInput(event.target.value);
  };

  const onPromptSubmit = async () => {
  const sanitizedUserInput = sanitizeString(userInput.trim());
  if (!sanitizedUserInput) return;

  setUserInput("");

  const conversationTurnId = uuidv4();

  const newTurn: ChatTurn = {
    id: conversationTurnId,
    question: sanitizedUserInput,
    answer: "",
    error: null,
    isPending: true,
    sources: [],
  };

  setChatTurns([newTurn]);
  setIsChatResponsePending(true);

  abortControllerRef.current = new AbortController();
  resetStreamingRefs();

  const { onAnswerUpdate, onSourcesUpdate } = createStreamingCallbacks(
    // Mise à jour du texte (chunk par chunk)
    (answerChunk: string) => {
      console.log("✅ Chunk reçu :", JSON.stringify(answerChunk));
      setChatTurns((prevTurns) =>
        prevTurns.map((turn) =>
          turn.id === conversationTurnId
            ? { ...turn, answer: (turn.answer || "") + answerChunk }
            : turn
        )
      );
    },
    // Mise à jour des sources
    (sources) => {
      setChatTurns((prevTurns) =>
        prevTurns.map((turn) =>
          turn.id === conversationTurnId ? { ...turn, sources } : turn
        )
      );
    }
  );

  try {
    await postPrompt({
      prompt: sanitizedUserInput,
      signal: abortControllerRef.current.signal,
      onAnswerUpdate,
      onSourcesUpdate,
    }).unwrap();

    // Sauvegarde finale après streaming réussi
    await saveChatAndFetch(sanitizedUserInput);
  } catch (error: any) {
    console.error("Streaming error:", error);
    handleStreamingError(error, /* tes callbacks d'erreur */);
  } finally {
    setChatTurns((prevTurns) =>
      prevTurns.map((turn) =>
        turn.id === conversationTurnId ? { ...turn, isPending: false } : turn
      )
    );
    setIsChatResponsePending(false);
  }
};

  return {
    userInput,
    chatTurns,
    isChatResponsePending,
    isChatSideMenuOpen,
    onPromptChange,
    onPromptSubmit,
    onRequestAbort,
  };
};
