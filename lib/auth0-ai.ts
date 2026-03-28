// lib/auth0-ai.ts
import { Auth0AI, getAccessTokenForConnection } from "@auth0/ai-langchain";
import { auth0 } from "@auth0/nextjs-auth0";

const auth0AI = new Auth0AI();

// GitHub connection (no scopes — set them in the GitHub OAuth App instead)
export const withGitHubConnection = auth0AI.withFederatedConnection({
  connection: "github",
  scopes: [],
  refreshToken: async () => {
    const session = await auth0.getSession();
    return session?.tokenSet.refreshToken!;
  },
});

// Google connection
export const withGoogleConnection = auth0AI.withFederatedConnection({
  connection: "google-oauth2",
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  refreshToken: async () => {
    const session = await auth0.getSession();
    return session?.tokenSet.refreshToken!;
  },
});

// Use this inside any tool to get the current OAuth token
export { getAccessTokenForConnection };