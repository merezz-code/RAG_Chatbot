// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { ServiceStatus } from "@intel-enterprise-rag-ui/control-plane";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "@xyflow/react";

import {
  graphEdges,
  graphNodes,
  llmNodePositionNoGuards,
  vllmNodePositionNoGuards,
} from "@/features/admin-panel/control-plane/config/chat-qna-graph";
import {
  ServiceData,
  ServiceDetails,
} from "@/features/admin-panel/control-plane/types";
import {
  FetchedServiceDetails,
  FetchedServicesData,
} from "@/features/admin-panel/control-plane/types/api";
import { RootState } from "@/store/index";

interface ChatQnAGraphState {
  nodes: Node<ServiceData>[];
  edges: Edge[];
  isLoading: boolean;
  selectedServiceNode: Node<ServiceData> | null;
  isRenderable: boolean;
}

const initialState: ChatQnAGraphState = {
  nodes: graphNodes,
  edges: [],
  isLoading: false,
  selectedServiceNode: null,
  isRenderable: false,
};

export const resetChatQnAGraph = createAsyncThunk(
  "chatQnAGraph/resetChatQnAGraph",
  (_, { dispatch }) => {
    dispatch(setChatQnAGraphSelectedServiceNode([]));
    dispatch(setChatQnAGraphIsLoading(true));
  },
);

export const setupChatQnAGraph = createAsyncThunk(
  "chatQnAGraph/setupChatQnAGraph",
  ({ parameters, details }: FetchedServicesData, { dispatch }) => {
    dispatch(setChatQnAGraphNodes({ parameters, details }));
    dispatch(setChatQnAGraphEdges(details));
    dispatch(setChatQnAGraphIsRenderable(true));
  },
);

const updateNodes = (fetchedServicesData: FetchedServicesData) => {
  const updatedNodes = graphNodes
    .map((node) => updateNodeDetails(node, fetchedServicesData))
    .filter((node) => node.data.status);

  const updatedNodesIds = updatedNodes.map(({ id }) => id);
  const llmNodeIndex = updatedNodes.findIndex(({ id }) => id === "llm");
  const vllmNodeIndex = updatedNodes.findIndex(({ id }) => id === "vllm");

  if (
    !updatedNodesIds.includes("input_guard") &&
    !updatedNodesIds.includes("output_guard") &&
    llmNodeIndex !== -1
  ) {
    updatedNodes[llmNodeIndex].position = llmNodePositionNoGuards;
  }

  if (
    !updatedNodesIds.includes("input_guard") &&
    !updatedNodesIds.includes("output_guard") &&
    vllmNodeIndex !== -1
  ) {
    updatedNodes[vllmNodeIndex].position = vllmNodePositionNoGuards;
  }

  return updatedNodes;
};

// chatQnAGraph.slice.ts

const updateNodeDetails = (
  node: Node<ServiceData>,
  fetchedServicesData: FetchedServicesData,
): Node<ServiceData> => {
  const nodeId = node.data.id;
  let nodeDetails: ServiceDetails = {};
  let nodeStatus: ServiceStatus | undefined;

  const { details: serviceDetails, parameters } = fetchedServicesData;
  if (serviceDetails[nodeId]) {
    const { details, status } = serviceDetails[nodeId];
    nodeDetails = details || {};
    nodeStatus = status as ServiceStatus;
  }

  // Structure par défaut pour inputGuardArgs si manquant
  const defaultInputGuardArgs = {
    prompt_injection_scanner: { enabled: true },
    ban_substrings_scanner: { enabled: false, substrings: [] },
    code_scanner: { enabled: false },
    invisible_text_scanner: { enabled: false },
    regex_scanner: { enabled: false, patterns: [] },
    secrets_scanner: { enabled: false },
    sentiment_scanner: { enabled: false },
    token_limit_scanner: { enabled: false, max_tokens: 1000 },
    toxicity_scanner: { enabled: false }
  };

  // Structure par défaut pour outputGuardArgs
  const defaultOutputGuardArgs = {
    prompt_injection_scanner: { enabled: false },
    ban_substrings_scanner: { enabled: false, substrings: [] },
    code_scanner: { enabled: false },
    invisible_text_scanner: { enabled: false },
    regex_scanner: { enabled: false, patterns: [] },
    secrets_scanner: { enabled: false },
    sentiment_scanner: { enabled: false },
    token_limit_scanner: { enabled: false, max_tokens: 1000 },
    toxicity_scanner: { enabled: false }
  };

  const servicesArgsMap: Record<string, unknown> = {
    llmArgs: parameters.llmArgs,
    rerankerArgs: parameters.rerankerArgs,
    retrieverArgs: parameters.retrieverArgs,
    // Fournir des valeurs par défaut si undefined
    inputGuardArgs: parameters.inputGuardArgs || defaultInputGuardArgs,
    outputGuardArgs: parameters.outputGuardArgs || defaultOutputGuardArgs,
    promptTemplateArgs: parameters.promptTemplateArgs,
  };

  for (const [key, value] of Object.entries(servicesArgsMap)) {
    if (node.data[key] !== undefined) {
      return {
        ...node,
        data: {
          ...node.data,
          details: nodeDetails,
          status: nodeStatus,
          [key]: value,
        },
      };
    }
  }

  return {
    ...node,
    data: {
      ...node.data,
      details: nodeDetails,
      status: nodeStatus,
    },
  };
};

export const chatQnAGraphSlice = createSlice({
  name: "chatQnAGraph",
  initialState,
  reducers: {
    onChatQnAGraphNodesChange: (
      state,
      action: PayloadAction<NodeChange<Node<ServiceData>>[]>,
    ) => {
      const changes = action.payload;
      state.nodes = applyNodeChanges(changes, [
        ...state.nodes,
      ]) as typeof state.nodes;
    },
    onChatQnAGraphEdgesChange: (
      state,
      action: PayloadAction<EdgeChange<Edge>[]>,
    ) => {
      const changes = action.payload;
      state.edges = applyEdgeChanges(changes, state.edges as Edge[]);
    },
    onChatQnAGraphConnect: (
      state,
      action: PayloadAction<Edge | Connection>,
    ) => {
      const edgeParams = action.payload;
      state.edges = addEdge(edgeParams, state.edges);
    },
    setChatQnAGraphEdges: (
      state,
      action: PayloadAction<FetchedServiceDetails>,
    ) => {
      const details = action.payload;
      const hasInputGuard = details.input_guard.status !== undefined;
      state.edges = hasInputGuard
        ? graphEdges.filter((edge) => edge.id !== "prompt_template-llm")
        : graphEdges;
    },
    setChatQnAGraphNodes: (
      state,
      action: PayloadAction<FetchedServicesData>,
    ) => {
      const fetchedServicesData = action.payload;
      state.nodes = updateNodes(fetchedServicesData) as typeof state.nodes;
    },
    setChatQnAGraphSelectedServiceNode: (
      state,
      action: PayloadAction<Node<ServiceData>[]>,
    ) => {
      const nodes = action.payload;
      if (nodes.length && nodes[0] !== state.selectedServiceNode) {
        state.selectedServiceNode =
          nodes[0] as typeof state.selectedServiceNode;
      } else {
        state.selectedServiceNode = null;
      }
      state.nodes = [...state.nodes].map((node) => ({
        ...node,
        data: {
          ...node.data,
          selected: state.selectedServiceNode
            ? node.id === state.selectedServiceNode.id
            : false,
        },
      }));
    },
    setChatQnAGraphIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setChatQnAGraphIsRenderable: (state, action: PayloadAction<boolean>) => {
      state.isRenderable = action.payload;
    },
    resetChatQnAGraphSlice: () => initialState,
  },
});

export const {
  onChatQnAGraphNodesChange,
  onChatQnAGraphEdgesChange,
  onChatQnAGraphConnect,
  setChatQnAGraphEdges,
  setChatQnAGraphNodes,
  setChatQnAGraphIsLoading,
  setChatQnAGraphSelectedServiceNode,
  setChatQnAGraphIsRenderable,
  resetChatQnAGraphSlice,
} = chatQnAGraphSlice.actions;

export const chatQnAGraphNodesSelector = (state: RootState) =>
  state.chatQnAGraph.nodes;
export const chatQnAGraphEdgesSelector = (state: RootState) =>
  state.chatQnAGraph.edges;
export const chatQnAGraphIsLoadingSelector = (state: RootState) =>
  state.chatQnAGraph.isLoading;
export const chatQnAGraphSelectedServiceNodeSelector = (state: RootState) =>
  state.chatQnAGraph.selectedServiceNode;
export const chatQnAGraphIsRenderableSelector = (state: RootState) =>
  state.chatQnAGraph.isRenderable;

export default chatQnAGraphSlice.reducer;
