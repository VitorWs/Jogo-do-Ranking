# Jogo do Ranking

Versão web multiplayer em tempo real inspirada em board games de ranking. A cada rodada, 5 cartas aleatórias são sorteadas na mesa e um jogador organiza a sua ordem secreta do 1º ao 5º lugar, enquanto os amigos tentam adivinhar exatamente como ele pensou.

**Jogue agora:** [https://jogo-do-ranking.vercel.app/](https://jogo-do-ranking.vercel.app/)

## Como funciona
1. **Crie uma sala** e compartilhe o link com os amigos.
2. **O Ranqueador da vez** recebe 5 cartas aleatórias e ordena em segredo do **1º** ao **5º** segundo seu próprio critério.
3. **Os demais jogadores** montam seus palpites tentando acertar a ordem exata.
4. **Revelação em suspense:** o Ranqueador abre carta por carta — mostrando primeiro os palpites da galera e depois o gabarito oficial.
5. Cada posição exata vale **1 ponto** (e cravar todas as 5 garante **+2 pontos de bônus**).

## Tecnologias
* React + Vite + Tailwind CSS
* Firebase Firestore (sincronização de salas em tempo real)
* Vercel (hospedagem)
