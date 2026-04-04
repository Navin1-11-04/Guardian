import { Auth0AI, getAccessTokenFromTokenVault } from "@auth0/ai-langchain";

export const getAccessToken = async () => getAccessTokenFromTokenVault();

export const auth0AI = new Auth0AI();