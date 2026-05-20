// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ERROR_MESSAGES } from "@/features/admin-panel/data-ingestion/config/api";
import { PostFileRequest } from "@/features/admin-panel/data-ingestion/types/api";
import { RootState } from "@/store";
import { handleOnQueryStarted, transformErrorMessage } from "@/utils/api";

// On définit la base URL vers votre API .NET (via le proxy Vite)
const s3ApiBaseQuery = fetchBaseQuery({
  baseUrl: "/api/v1/edp", // S'assure que les requêtes vont vers l'API
});

export const s3Api = createApi({
  reducerPath: "s3Api",
  baseQuery: s3ApiBaseQuery,
  tagTypes: ["Files"], // Permet de rafraîchir la liste après suppression
  endpoints: (builder) => ({
    // Gardé pour l'upload si nécessaire
    postFile: builder.mutation<void, PostFileRequest>({
      query: ({ url, file }) => ({
        url,
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      }),
      onQueryStarted: async ({ file }, { dispatch, queryFulfilled }) => {
        await handleOnQueryStarted(
          queryFulfilled,
          dispatch,
          `${ERROR_MESSAGES.POST_FILE} ${file.name}`,
        );
      },
    }),

    // MODIFIÉ : Accepte maintenant l'ID du fichier
    deleteFile: builder.mutation<void, string>({
      query: (id) => ({
        url: `file/${id}`, 
        method: "DELETE",
      }),
      invalidatesTags: ["Files"],
      transformErrorResponse: (error) =>
        transformErrorMessage(error, ERROR_MESSAGES.DELETE_FILE),
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        await handleOnQueryStarted(queryFulfilled, dispatch, ERROR_MESSAGES.DELETE_FILE);
      },
    }),
  }),
});

export const { usePostFileMutation, useDeleteFileMutation } = s3Api;
export const selectS3Api = (state: RootState) => state.s3Api;