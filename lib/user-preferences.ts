import catalog from '../backend/accounts/preferences_catalog.json';

export const avatarCatalog = catalog.avatars;
export const favoriteCatalog = catalog.blocks;
export const findAvatar = (id?: string) =>
  avatarCatalog.find((item) => item.id === id) ?? avatarCatalog[0];
export const validFavorite = (id: string) =>
  favoriteCatalog.some((item) => item.type === id);
export type Preferences = {
  avatarId: string;
  favorites: string[];
  version: number;
  configured: boolean;
};
export function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as Preferences;
  return (
    typeof p.avatarId === 'string' &&
    Number.isSafeInteger(p.version) &&
    p.version > 0 &&
    typeof p.configured === 'boolean' &&
    Array.isArray(p.favorites) &&
    p.favorites.length <= 100 &&
    p.favorites.every((item) => typeof item === 'string')
  );
}

export class PreferenceError extends Error {
  constructor(
    message: string,
    public code = 'network_error',
  ) {
    super(message);
  }
}
