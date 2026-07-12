# ♟️ Jogo de Dama com IA

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Last commit](https://img.shields.io/github/last-commit/RobersonCodes/checkers-game?style=flat-square)](https://github.com/RobersonCodes/checkers-game/commits/main)

Projeto desenvolvido em **TypeScript** com foco em **lógica de programação**, **regras de negócio**, **interface interativa** e **inteligência artificial**.

O jogo implementa regras reais de dama, sistema de histórico, salvamento local, placar persistente e modo contra computador usando **Minimax com poda alfa-beta**.

---

## 📸 Captura de tela

![Captura de tela do Jogo de Dama](docs/screenshot.png)

---

## 🚀 Demonstração

```bash
https://seu-projeto.vercel.app
```

## 📌 Funcionalidades

- Tabuleiro de dama 8x8
- Regras oficiais de movimentação
- Captura de peças
- Captura obrigatória
- Regra da maior captura (lei da maioria)
- Múltiplas capturas na mesma jogada
- Dama voadora (movimento e captura à distância)
- Promoção para dama
- Destaque de movimentos possíveis
- Arrastar e soltar peças (com clique como alternativa)
- Sons e vibração ao jogar/capturar
- Histórico de jogadas
- Reinício de partida
- Salvamento e carregamento com localStorage
- Placar persistente entre partidas
- Nomes personalizados para jogadores
- Modal de vitória
- Modo 2 jogadores
- Modo contra IA
- Seleção de dificuldade
- IA com Minimax
- Otimização com poda alfa-beta

## 🧠 Inteligência Artificial

O modo contra computador utiliza o algoritmo Minimax com poda alfa-beta, permitindo que a IA:

- avalie possíveis jogadas futuras
- priorize capturas
- busque promoção para dama
- reduza caminhos desnecessários na árvore de decisão
- jogue de forma mais estratégica de acordo com a dificuldade escolhida

### Níveis de dificuldade

- Fácil
- Médio
- Difícil

A dificuldade altera a profundidade de análise da IA.

## 🛠️ Tecnologias utilizadas

- TypeScript
- HTML5
- CSS3
- Vite
- LocalStorage
- Web Audio API
- Algoritmo Minimax
- Poda alfa-beta

## 📂 Estrutura do projeto

```
checkers-game/
├── index.html
├── style.css
├── package.json
├── README.md
├── docs/
│   └── screenshot.png
└── src/
    ├── main.ts
    ├── game.ts
    ├── board.ts
    ├── rules.ts
    ├── ai.ts
    ├── render.ts
    ├── sound.ts
    └── types.ts
```
