// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { addNotification } from "@intel-enterprise-rag-ui/components";
import {
  createApi,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import {
  API_ENDPOINTS,
  ERROR_MESSAGES,
} from "@/features/admin-panel/control-plane/config/api";
import {
  resetChatQnAGraph,
  setChatQnAGraphIsLoading,
  setChatQnAGraphIsRenderable,
  setupChatQnAGraph,
} from "@/features/admin-panel/control-plane/store/chatQnAGraph.slice";
import {
  ChangeArgumentsRequest,
  GetServicesDataResponse,
  PostRetrieverQueryRequest,
} from "@/features/admin-panel/control-plane/types/api";
import {
  parseServiceDetailsResponseData,
  parseServicesParameters,
} from "@/features/admin-panel/control-plane/utils/api";
import { getErrorMessage, transformErrorMessage } from "@/utils/api";
import { keycloakService } from "@/utils/auth";
import { llmInputGuardArgumentsDefault }
from "@/features/admin-panel/control-plane/config/chat-qna-graph/guards/llmInputGuard";

import { llmOutputGuardArgumentsDefault }
from "@/features/admin-panel/control-plane/config/chat-qna-graph/guards/llmOutputGuard";
// Fonction utilitaire pour garantir un header Authorization valide pour le "Ghost Mode"
const getAuthHeader = () => {
  const token = keycloakService.getToken();
  // Si pas de token (mode fantôme), on envoie une chaîne factice pour éviter le 403 du filtre JWT
  return token ? `Bearer ${token}` : "Bearer ghost-token-placeholder";
};
const controlPlaneBaseQuery = fetchBaseQuery({

});

export const controlPlaneApi = createApi({
  reducerPath: "controlPlaneApi",
  baseQuery: controlPlaneBaseQuery,
  tagTypes: ["Services Data"],
  endpoints: (builder) => ({
    getServicesData: builder.query<GetServicesDataResponse, void>({
      queryFn: async (_arg, _queryApi, _extraOptions, fetchWithBQ): Promise<any> => {
        

        const [getServicesParameters, getServicesDetails] = await Promise.all([
          fetchWithBQ({
            url: API_ENDPOINTS.GET_SERVICES_PARAMETERS,
            method: "POST",
            headers: {
              "Content-Type": "application/json",

            },
            body: JSON.stringify({ text: "" }),
          }),
          fetchWithBQ({
            url: API_ENDPOINTS.GET_SERVICES_DETAILS,

          }),
        ]);

        // LOGS DE DEBUGGING (Tu pourras les enlever après)
        console.log("Raw Details Response:", getServicesDetails);


        const rawDetailsData = getServicesDetails.data as any;

        // Vérification que l'objet complet est valide (spec + status)
        const hasValidDetails = rawDetailsData?.spec?.nodes &&
          rawDetailsData?.status?.annotations !== undefined;

        if (getServicesDetails.error || !hasValidDetails) {
          console.warn("Fallback activé");
          return {
            data: {
              details: {} as GetServicesDataResponse['details'],
              parameters: {} as GetServicesDataResponse['parameters']
            }
          };
        }

        let details;
        try {
          // ✅ On passe l'objet COMPLET, pas juste spec
          details = parseServiceDetailsResponseData(rawDetailsData);
        } catch (e) {
          console.error("Erreur parsing:", e);
          details = {};
        }
        console.log("FULL RESPONSE:", JSON.stringify(getServicesDetails.data, null, 2));

       const parametersResponse = getServicesParameters.data as any;
const rawParams = parametersResponse?.parameters;

console.log("rawParams reçu:", rawParams); // debug

// ✅ Parser correctement selon le type reçu
const parsedParams = rawParams && !Array.isArray(rawParams)
  ? parseServicesParameters(rawParams)
  : parseServicesParameters({} as any);

// ✅ Garantir valeurs par défaut pour TOUS les scanners


const parameters = {
  ...parsedParams,
  inputGuardArgs:
    parsedParams?.inputGuardArgs ??
    llmInputGuardArgumentsDefault,

  outputGuardArgs:
    parsedParams?.outputGuardArgs ??
    llmOutputGuardArgumentsDefault,
};
console.log("INPUT GUARD", parameters.inputGuardArgs);
console.log("OUTPUT GUARD", parameters.outputGuardArgs);

return { data: { details, parameters }, error: undefined };
      },
      onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
        dispatch(setChatQnAGraphIsLoading(true));
        dispatch(resetChatQnAGraph());

        try {
          const { data } = await queryFulfilled;
          dispatch(setupChatQnAGraph(data));
          dispatch(setChatQnAGraphIsRenderable(true));
        } catch (error) {
          // On capture l'erreur sans faire crasher l'UI
          const errorMessage = getErrorMessage(
            (error as any).error,
            ERROR_MESSAGES.GET_SERVICES_DATA,
          );
          dispatch(addNotification({ severity: "error", text: errorMessage }));
          dispatch(setChatQnAGraphIsRenderable(false));
        } finally {
          dispatch(setChatQnAGraphIsLoading(false));
        }
      },
      providesTags: ["Services Data"],
    }),

    changeArguments: builder.mutation<Response, ChangeArgumentsRequest>({
      query: (requestBody) => ({
        url: API_ENDPOINTS.CHANGE_ARGUMENTS,
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",
          "Authorization": getAuthHeader(),
        },
      }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        dispatch(resetChatQnAGraph());
        try {
          await queryFulfilled;
        } catch (error) {
          const errorMessage = getErrorMessage(
            (error as { error: FetchBaseQueryError }).error,
            ERROR_MESSAGES.CHANGE_ARGUMENTS,
          );
          dispatch(addNotification({ severity: "error", text: errorMessage }));
        }
      },
      transformErrorResponse: (error) =>
        transformErrorMessage(error, ERROR_MESSAGES.CHANGE_ARGUMENTS),
      invalidatesTags: ["Services Data"],
    }),

    postRetrieverQuery: builder.mutation<string, PostRetrieverQueryRequest>({
      query: (requestBody) => ({
        url: API_ENDPOINTS.POST_RETRIEVER_QUERY,
        method: "POST",
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",

        },
        responseHandler: async (response) => await response.text(),
      }),
      transformErrorResponse: (error) =>
        transformErrorMessage(error, ERROR_MESSAGES.POST_RETRIEVER_QUERY),
    }),
  }),
});

export const {
  useGetServicesDataQuery,
  useChangeArgumentsMutation,
  usePostRetrieverQueryMutation,
} = controlPlaneApi;