# ♠ Paciência de Cartas

Jogo da paciência (Klondike) em **PWA mobile-first**, em português (pt-BR).

## Como jogar

- **Ajuda 💡**: mostra a jogada mais inteligente (uma dentre: base, revelação de carta, coluna vazia). **3 usos por partida**.
- **Voltar ↩**: desfaz a última jogada. **3 usos por partida**.
- **Nova partida ↻**: confirma (dupla-toque) e recomeça.
- **Comprar carta**: toque no baralho.
- **Reembaralhar**: quando o baralho zerar, toque nele de novo — ele devolve as cartas do descarte ao baralho (invertidas, viradas para baixo) para você recompartilhar.
- **Mover carta**: toque numa carta (ou sequência) para selecionar, depois toque no destino.
  - Colunas vazias aceitam apenas **Rei sozinho**.
  - Bases aceitam sequência crescente do mesmo naipe ( Ás → Rei).
- **Fim de jogo**: quando não houver mais jogadas (ou quando as 4 bases estiverem completas — vitória).

## Layout

Pensado para **paisagem** (mobile e desktop): barra lateral com ações, tabuleiro com as 7 colunas.
Em retrato (mobile de toque), aparece o aviso para virar o aparelho.

## Rodar localmente

```bash
# A partir da raiz do projeto:
python3 -m http.server 8080
# depois abrir http://localhost:8080
```

## Testes

```bash
node --test tests/engine.test.js
```

## Deploy

É uma PWA estática: basta servir os arquivos (ex.: GitHub Pages, Netlify, Vercel). A instalação ("Adicionar à tela inicial") exige um contexto seguro (HTTPS ou localhost).

## Estrutura

```
├── index.html      # HTML principal
├── css/styles.css  # Estilos (landscape-first)
├── js/engine.js    # Regras puras (sem DOM) — dicas e validação de jogadas
├── js/app.js       # Renderização e interações
├── manifest.json   # PWA manifest
├── sw.js           # Service worker (cache-first, offline)
├── icons/          # Ícones gerados com scripts/make_icons.py
├── scripts/        # Gerador de ícones (PIL)
└── tests/          # Testes do motor (node:test)
```

O service worker usa cache-first: ao atualizar arquivos, aumentar a versão em `sw.js` (`CACHE`) e a query de versão dos módulos JS (`?v=N` em `index.html` e `js/app.js`) — assim o navegador não reutiliza o módulo cacheado.
