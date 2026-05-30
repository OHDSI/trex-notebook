export interface Config {
  apiUrl: string;
  cognitoDomain: string;
  clientId: string;
  redirectUri: string;
}

export const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '',
  cognitoDomain: import.meta.env.VITE_COGNITO_DOMAIN ?? '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? `${location.origin}/callback`,
};
