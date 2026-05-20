// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

import {
  ABORT_ERROR_MESSAGE,
  DEFAULT_ERROR_MESSAGE,
  HTTP_ERRORS,
} from "@/api/config";
import {
  AnswerUpdateHandler,
  ChatErrorResponse,
  SourcesUpdateHandler,
} from "@/types/api";

export const handleChatJsonResponse = async (
  response: Response,
  onAnswerUpdate: AnswerUpdateHandler,
  onSourcesUpdate: SourcesUpdateHandler,
) => {
  const json = await response.json();
  console.log("📦 JSON reçu:", JSON.stringify(json).slice(0, 500));
  console.log("📎 sources:", json.json?.reranked_docs);
  onAnswerUpdate(json.text);
  onSourcesUpdate(json.json?.reranked_docs || []);
};

export const handleChatStreamResponse = async (
  response: Response,
  onAnswerUpdate: AnswerUpdateHandler,
  onSourcesUpdate: SourcesUpdateHandler,
) => {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");

      // Garder le dernier morceau incomplet
      buffer = events.pop() || "";

      for (const event of events) {
        if (!event.trim()) continue;

        if (event.startsWith("data: ")) {
          const dataContent = event.slice(6).trim();

          if (dataContent === "[DONE]" || dataContent.includes("</s>")) continue;

          try {
            // Cas 1 : JSON OpenAI-like
            const parsed = JSON.parse(dataContent);
            if (parsed.choices?.[0]?.delta?.content) {
              onAnswerUpdate(parsed.choices[0].delta.content);
            } else if (typeof parsed === "string") {
              onAnswerUpdate(parsed);
            }
          } catch {
            // Cas 2 : Texte brut (le plus probable dans ton cas actuel)
            let cleanText = dataContent
              .replace(/^"|"$/g, "")           // Enlever guillemets externes
              .replace(/\\n/g, "\n")
              .replace(/\\t/g, "\t");

            onAnswerUpdate(cleanText);
          }
        }

        // Gestion des sources (JSON)
        if (event.startsWith("json: ")) {
          try {
            const jsonData = JSON.parse(event.slice(6).trim());
            onSourcesUpdate(jsonData.reranked_docs || []);
          } catch (e) {
            console.warn("Failed to parse sources JSON", e);
          }
        }
      }
    }
  } catch (err) {
    console.error("Stream reading error:", err);
  } finally {
    reader.releaseLock();
  }
};

export const createGuardrailsErrorResponse = async (response: Response) => {
  const errorData = await response.json();
  const guardrailsErrorResponse = {} as ChatErrorResponse;
  guardrailsErrorResponse.data = errorData;
  return guardrailsErrorResponse;
};

export const transformChatErrorResponse = (
  error: FetchBaseQueryError,
): Pick<ChatErrorResponse, "status" | "data"> => {
  const responseError = error as ChatErrorResponse;

  if (isAbortResponseError(responseError)) {
    return {
      status: HTTP_ERRORS.CLIENT_CLOSED_REQUEST.statusCode,
      data: HTTP_ERRORS.CLIENT_CLOSED_REQUEST.errorMessage,
    };
  }

  const statusCode = responseError.originalStatus || responseError.status;

  switch (statusCode) {
    case HTTP_ERRORS.REQUEST_TIMEOUT.statusCode:
      return {
        status: HTTP_ERRORS.REQUEST_TIMEOUT.statusCode,
        data: HTTP_ERRORS.REQUEST_TIMEOUT.errorMessage,
      };
    case HTTP_ERRORS.PAYLOAD_TOO_LARGE.statusCode:
      return {
        status: HTTP_ERRORS.PAYLOAD_TOO_LARGE.statusCode,
        data: HTTP_ERRORS.PAYLOAD_TOO_LARGE.errorMessage,
      };
    case HTTP_ERRORS.TOO_MANY_REQUESTS.statusCode:
      return {
        status: HTTP_ERRORS.TOO_MANY_REQUESTS.statusCode,
        data: HTTP_ERRORS.TOO_MANY_REQUESTS.errorMessage,
      };
    case HTTP_ERRORS.GUARDRAILS_ERROR.statusCode:
      return {
        status: HTTP_ERRORS.GUARDRAILS_ERROR.statusCode,
        data: parseGuardrailsResponseErrorDetail(responseError),
      };
    default:
      return {
        status: statusCode,
        data: DEFAULT_ERROR_MESSAGE,
      };
  }
};

const isAbortResponseError = (errorResponse: ChatErrorResponse) => {
  const isFetchAbortError =
    errorResponse.status === "FETCH_ERROR" &&
    errorResponse.error === ABORT_ERROR_MESSAGE;
  const containsBrowserAbortMessage =
    typeof errorResponse.error === "string" &&
    (errorResponse.error.toLowerCase().includes("abort") ||
      errorResponse.error.toLowerCase().includes("interrupt") ||
      errorResponse.error === "AbortError: BodyStreamBuffer was aborted" || // Edge & Chrome
      errorResponse.error === "User interrupted chatbot response."); // Firefox
  const isParsingAbortError =
    errorResponse.status === "PARSING_ERROR" &&
    errorResponse.originalStatus === 200 &&
    containsBrowserAbortMessage;
  return isFetchAbortError || isParsingAbortError;
};

const parseGuardrailsResponseErrorDetail = (
  responseError: ChatErrorResponse,
) => {
  try {
    if (!isChatErrorResponseDataString(responseError.data)) {
      return HTTP_ERRORS.GUARDRAILS_ERROR.parsingErrorMessages.INVALID_FORMAT;
    }

    const parsedResponseData = JSON.parse(responseError.data);

    if (!parsedResponseData.error) {
      return HTTP_ERRORS.GUARDRAILS_ERROR.parsingErrorMessages.MISSING_ERROR;
    } else if (typeof parsedResponseData.error !== "string") {
      return HTTP_ERRORS.GUARDRAILS_ERROR.parsingErrorMessages
        .INVALID_ERROR_FORMAT;
    }

    const errorObj = JSON.parse(parsedResponseData.error);
    return (
      errorObj.detail ||
      HTTP_ERRORS.GUARDRAILS_ERROR.parsingErrorMessages.UNKNOWN
    );
  } catch {
    return HTTP_ERRORS.GUARDRAILS_ERROR.parsingErrorMessages.PARSING_FAILED;
  }
};

export const isChatErrorResponse = (
  error?: FetchBaseQueryError | SerializedError,
): error is ChatErrorResponse =>
  error !== null &&
  typeof error === "object" &&
  "status" in error &&
  "data" in error;

export const isChatErrorResponseDataString = (data: unknown): data is string =>
  typeof data === "string";
