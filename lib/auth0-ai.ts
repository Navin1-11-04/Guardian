import { Auth0AI, getAccessTokenFromTokenVault } from "@auth0/ai-langchain";
import { auth0 } from "@/lib/auth0";

export const getAccessToken = async () => getAccessTokenFromTokenVault();

const auth0AI = new Auth0AI({
  auth0: {
    domain: process.env.AUTH0_DOMAIN!,
    clientId: process.env.AUTH0_CLIENT_ID!,
    clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  },
});

export const withGitHubConnection = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo", "read:user"],
  accessToken: async (_, config: any) => {
    // Try configurable first (passed from agent invocation)
    if (config?.configurable?.accessToken) {
      return config.configurable.accessToken;
    }
    // Fallback to session
    const session = await auth0.getSession();
    return session?.tokenSet?.accessToken!;
  },
});