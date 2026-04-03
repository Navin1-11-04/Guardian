// lib/auth0-ai.ts
import { Auth0AI, getAccessTokenFromTokenVault } from "@auth0/ai-langchain";
import { auth0 } from "@/lib/auth0";

// Use this inside any tool to get the current OAuth token
export const getAccessToken = async () => getAccessTokenFromTokenVault();

const auth0AI = new Auth0AI();

// GitHub connection
export const withGitHubConnection = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo", "read:user"],
  accessToken: async () => {
    const session = await auth0.getSession();
    return session?.tokenSet?.accessToken!;
  },
});

// Google connection
export const withGoogleConnection = auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  accessToken: async () => {
    const session = await auth0.getSession();
    return session?.tokenSet?.accessToken!;
  },
});