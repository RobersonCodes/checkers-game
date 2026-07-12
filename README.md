# ♟️ Jogo de Dama com IA

Projeto desenvolvido em **TypeScript** com foco em **lógica de programação**, **regras de negócio**, **interface interativa** e **inteligência artificial**.

O jogo implementa regras reais de dama, sistema de histórico, salvamento local, placar persistente e modo contra computador usando **Minimax com poda alfa-beta**.

---

## 🚀 Demonstração

```bash
https://seu-projeto.vercel.app

📌 Funcionalidades

Tabuleiro de dama 8x8

Regras oficiais de movimentação

Captura de peças

Captura obrigatória

Múltiplas capturas na mesma jogada

Promoção para dama

Destaque de movimentos possíveis

Histórico de jogadas

Reinício de partida

Salvamento e carregamento com localStorage

Placar persistente entre partidas

Nomes personalizados para jogadores

Modal de vitória

Modo 2 jogadores

Modo contra IA

Seleção de dificuldade

IA com Minimax

Otimização com poda alfa-beta

🧠 Inteligência Artificial

O modo contra computador utiliza o algoritmo Minimax com poda alfa-beta, permitindo que a IA:

avalie possíveis jogadas futuras

priorize capturas

busque promoção para dama

reduza caminhos desnecessários na árvore de decisão

jogue de forma mais estratégica de acordo com a dificuldade escolhida

Níveis de dificuldade

Fácil

Médio

Difícil

A dificuldade altera a profundidade de análise da IA.

🛠️ Tecnologias utilizadas

TypeScript

HTML5

CSS3

Vite

LocalStorage

Algoritmo Minimax

Poda alfa-beta

📂 Estrutura do projeto
checkers-game/
├── index.html
├── package.json
├── README.md
├── src/
│   ├── main.ts
│   ├── board.ts
│   ├── game.ts
│   ├── render.ts
│   ├── types.ts
│   └── style.css