const PLAYER_ID_KEY = 'playerId';
const PLAYER_NAME_KEY = 'playerName';

/**
 * Obtém o playerId salvo no sessionStorage ou cria um novo ID único sem pontos.
 * @returns {string}
 */
export function getOrCreatePlayerId() {
  let existingId = sessionStorage.getItem(PLAYER_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const newId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  sessionStorage.setItem(PLAYER_ID_KEY, newId);
  return newId;
}

/**
 * Lê o apelido salvo no sessionStorage.
 * @returns {string}
 */
export function getSavedNickname() {
  return sessionStorage.getItem(PLAYER_NAME_KEY) || '';
}

/**
 * Salva o apelido do jogador no sessionStorage.
 * @param {string} name
 */
export function saveNickname(name) {
  sessionStorage.setItem(PLAYER_NAME_KEY, name);
}
