// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { downloadBlob } from "@intel-enterprise-rag-ui/utils";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { API_ENDPOINTS, ERROR_MESSAGES } from "@/config/api";
import { DownloadFileRequest, GetFilePresignedUrlRequest } from "@/types/api";
import { handleOnQueryStarted, transformErrorMessage } from "@/utils/api";
import { keycloakService } from "@/utils/auth";

const AUTHORIZED_ENDPOINTS = ["getFilePresignedUrl", "downloadFile"];

const appBaseQuery = fetchBaseQuery({
  prepareHeaders: async (headers: Headers) => {
    const token = localStorage.getItem("jwt");
    const username = localStorage.getItem("username");
    
    
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (username) headers.set("X-User-Id", username);
    headers.set("Content-Type", "application/json");
    return headers;
  },
});

export const appApi = createApi({
  reducerPath: "appApi",
  baseQuery: appBaseQuery,
  endpoints: (builder) => ({
    downloadFile: builder.query<void, DownloadFileRequest>({
      query: ({ presignedUrl, fileName }) => ({
        url: presignedUrl,
        responseHandler: async (response) => {
          if (!response.ok) {
            return Promise.reject(ERROR_MESSAGES.DOWNLOAD_FILE);
          }

          const fileBlob = await response.blob();
          downloadBlob(fileBlob, fileName);
        },
      }),
      transformErrorResponse: (error) =>
        transformErrorMessage(error, ERROR_MESSAGES.DOWNLOAD_FILE),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        await handleOnQueryStarted(
          queryFulfilled,
          dispatch,
          ERROR_MESSAGES.DOWNLOAD_FILE,
        );
      },
    }),
    getFilePresignedUrl: builder.mutation<string, GetFilePresignedUrlRequest>({
      query: ({ id, fileName, method = "GET" }) => ({
        url: API_ENDPOINTS.GET_FILE_PRESIGNED_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: id,
          objectName: fileName,
          method: method,
        }),
      }),
      // ✅ Response Handler amélioré + typé
      transformResponse: (response: any): string => {
        if (typeof response === 'string') {
          return response;
        }
        if (response?.url) {
          return response.url;
        }
        if (response?.Url) {
          return response.Url;
        }
        console.warn("Presigned URL response format unexpected:", response);
        return response as string; // fallback
      },

      transformErrorResponse: (error) =>
        transformErrorMessage(error, ERROR_MESSAGES.GET_FILE_PRESIGNED_URL),

      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        await handleOnQueryStarted(
          queryFulfilled,
          dispatch,
          ERROR_MESSAGES.GET_FILE_PRESIGNED_URL,
        );
      },
    }),
  }),
});

export const { useLazyDownloadFileQuery, useGetFilePresignedUrlMutation } =
  appApi;
