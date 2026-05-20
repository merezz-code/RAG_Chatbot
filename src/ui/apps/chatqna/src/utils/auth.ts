// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { paths } from "@/config/paths";

class MonRAGAuthService {
  // ── Identité ──────────────────────────────────────────────
  getUsername(): string {
    return localStorage.getItem("username") ?? "";
  }

  getEmail(): string {
    return localStorage.getItem("email") ?? "";
  }

  // ── Token ─────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem("jwt");
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem("jwt");
  }

  // ── Rôles ─────────────────────────────────────────────────
  isAdminUser(): boolean {
    return localStorage.getItem("isAdmin") === "true";
  }

  hasResourceRole(role: string): boolean {
    if (role === "admin") return this.isAdminUser();
    return false;
  }

  hasRealmRole(role: string): boolean {
    if (role === "admin") return this.isAdminUser();
    return false;
  }

  // ── Logout ────────────────────────────────────────────────
  logout(): void {
    this._clearStorage();
    window.location.href = "/login";
  }

  // Méthode appelée par AppHeaderContent ligne 91
  redirectToLogout(): void {
    this._clearStorage();
    window.location.href = "/login";
  }

  private _clearStorage(): void {
    localStorage.removeItem("jwt");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("isAdmin");
  }
  // Dans MonRAGAuthService
async refreshToken(_minValidity = 30): Promise<boolean> {
  return !!localStorage.getItem("jwt");
}

async updateToken(_minValidity = 30): Promise<boolean> {
  return this.refreshToken(_minValidity);
}

  // ── Init (no-op) ──────────────────────────────────────────
  setup(_config: unknown): void {}

  init(onInitialized: () => void): void {
    Promise.resolve().then(onInitialized);
  }
}

export const keycloakService = new MonRAGAuthService();

export function initializeKeycloak(onInitialized: () => void) {
  keycloakService.init(onInitialized);
}

export const authUtils = {
  getToken: () => keycloakService.getToken(),
  isAuthenticated: () => keycloakService.isAuthenticated(),
  logout: () => keycloakService.redirectToLogout(),
  getHeaders: (): HeadersInit => ({
    Authorization: `Bearer ${keycloakService.getToken()}`,
    "Content-Type": "application/json",
  }),
};