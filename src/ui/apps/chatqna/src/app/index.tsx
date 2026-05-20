// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0


import AppProvider from "@/app/provider";
import AppRouter from "@/app/router";

const App = () => {
  // useTokenRefresh(keycloakService); ← déjà commenté, bien

  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
};

export default App;
