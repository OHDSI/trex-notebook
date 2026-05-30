import { ApiClient } from './client';
import { config } from '../config';
import { getToken } from '../auth/session';

export const api = new ApiClient(config.apiUrl, () => getToken());
