/**
 * Gera um código de sala aleatório com 4 letras maiúsculas (A-Z).
 * @returns {string}
 */
export function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/**
 * Sorteia cartas inéditas usando embaralhamento Fisher-Yates.
 * Reinicia o baralho caso restem menos de `count` cartas não usadas.
 *
 * @param {string[]} allCards
 * @param {string[]} [usedCards=[]]
 * @param {number} [count=5]
 * @returns {string[]}
 */
export function drawCards(allCards, usedCards = [], count = 5) {
  if (!Array.isArray(allCards) || allCards.length === 0 || count <= 0) {
    return [];
  }

  const usedSet = new Set(Array.isArray(usedCards) ? usedCards : []);
  const available = allCards.filter((card) => !usedSet.has(card));
  const pool = available.length < count ? [...allCards] : [...available];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

/**
 * Conta quantas posições exatas (índices 0 a 4) coincidem entre o ranking secreto e o palpite.
 *
 * @param {string[]} secretRanking
 * @param {string[]} playerGuess
 * @returns {number}
 */
export function countExactMatches(secretRanking, playerGuess) {
  if (
    !Array.isArray(secretRanking) ||
    !Array.isArray(playerGuess) ||
    secretRanking.length < 5 ||
    playerGuess.length < 5
  ) {
    return 0;
  }

  let matches = 0;
  for (let i = 0; i < 5; i += 1) {
    if (secretRanking[i] === playerGuess[i]) {
      matches += 1;
    }
  }
  return matches;
}

/**
 * Compara o ranking secreto com o palpite do jogador (índices 0 a 4).
 * Soma 1 ponto por acerto na posição exata e +2 pontos de bônus se acertar todos os 5.
 *
 * @param {string[]} secretRanking
 * @param {string[]} playerGuess
 * @returns {number}
 */
export function calculateScore(secretRanking, playerGuess) {
  const matches = countExactMatches(secretRanking, playerGuess);
  return matches === 5 ? matches + 2 : matches;
}
