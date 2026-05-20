// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  LoadingFallback,
  useColorScheme,
} from "@intel-enterprise-rag-ui/components";
import { RootLayout } from "@intel-enterprise-rag-ui/layouts";
import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import ErrorRoute from "@/app/routes/error/ErrorRoute";
import ProtectedRoute from "@/components/ProtectedRoute/ProtectedRoute";
import { paths } from "@/config/paths";

const InitialChatRoute = lazy(
  () => import("@/app/routes/chat/InitialChatRoute"),
);
const ChatConversationRoute = lazy(
  () => import("@/app/routes/chat/ChatConversationRoute"),
);
const AdminPanelRoute = lazy(
  () => import("@/app/routes/admin-panel/AdminPanelRoute"),
);

import LoginRoute from "@/app/routes/login/LoginRoute";
import { authUtils } from "@/utils/auth";

// Guard simple
function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!authUtils.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  // Redirection racine
  {
    path: paths.root,
    element: <Navigate to={authUtils.isAuthenticated() ? paths.chat : "/login"} replace />,
  },

  // Page de login — SANS RootLayout
  {
    path: "/login",
    element: <LoginRoute />,
  },

  // Routes protégées
  {
    element: <RootLayout />,
    children: [
      {
        path: paths.chat,
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <InitialChatRoute />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: `${paths.chat}/:chatId`,
        element: (
          <RequireAuth>
            <Suspense fallback={<LoadingFallback />}>
              <ChatConversationRoute />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: `${paths.adminPanel}/*`,
        element: (
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <AdminPanelRoute />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <ErrorRoute /> },
    ],
  },
]);

const AppRouter = () => {
  // useColorScheme hook used here to provide color scheme for the app and LoadingFallback component
  useColorScheme();

  return <RouterProvider router={router} />;
};

export default AppRouter;
