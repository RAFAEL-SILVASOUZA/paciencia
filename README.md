# ♠ Paciência de Cartas

Jogo da paciência (Klondike) em **PWA mobile-first**, em português (pt-BR).

## Como jogar

- **Ajuda**: mostra a jogada mais inteligente (uma dentre: base, revelação de carta, coluna vazia). **10 usos por partida**. A dica nunca sugere puxar uma carta da base só para devolvê-la depois — quando só existe esse vai-e-volta, a partida é declarada travada (veja abaixo).
- **Voltar**: desfaz a última jogada (a cascata automática inteira conta como uma só). **10 usos por partida**.
- **Nova partida**: confirma (dupla-toque) e recomeça.
- **Comprar carta**: toque no baralho.
- **Reembaralhar**: quando o baralho zerar, toque nele de novo — ele devolve as cartas do descarte ao baralho (invertidas, viradas para baixo) para você recompartilhar.
- **Mover carta**: toque numa carta do descarte ou da mesa — ela se move sozinha para a melhor jogada legal (click inteligente). Toque numa base ou numa coluna vazia para auto-mover a melhor jogada para lá. Sem jogada possível, um aviso aparece.
  - Colunas vazias aceitam apenas **Rei sozinho**.
  - Bases aceitam sequência crescente do mesmo naipe ( Ás → Rei).
- **Auto-play**: quando uma carta vai para a base (manual ou automaticamente), as demais cartas da mesa e do descarte que também puderem ir para as bases vão sozinhas, em cascata — desfazer reverte a jogada + a cascata inteira.
- **Puxar de volta**: toque numa base preenchida quando nada pode ir para ela — a carta do topo volta para a melhor coluna da mesa (coluna vazia tem prioridade). Puxar não dispara auto-play e não conta como jogada para o fim de jogo.
- **Som 🔊**: efeitos sonoros discretos gerados via WebAudio (sem arquivos externos). O botão "Som" alterna entre ligado e mudo; a preferência fica salva no aparelho.
- **Vibração**: em aparelhos compatíveis, um toque háptico discreto a cada jogada.
- **Vitória**: fanfarra + cascata de cartas quicando na tela (toque na tela para pular).
- **Estatísticas**: vitórias, sequência atual e recordes (melhor tempo e menos jogadas numa vitória) ficam salvos no aparelho — aparecem no chip 🏆 da barra lateral e no fim de jogo.
- **Fim de jogo**: quando não houver mais jogadas (ou quando as 4 bases estiverem completas — vitória).
- **Jogo travado**: alguns embaralhos não têm solução — como o reembaralhar é ilimitado e preserva a ordem, o jogo cicla o baralho para sempre sem fim. Se um ciclo inteiro do baralho (todas as compras + reembaralhar) passar sem **nenhuma jogada produtiva**, a partida termina com o aviso "Jogo travado" e conta como derrota nas estatísticas. Puxar/devolver a mesma carta da base também conta como não-progresso.

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
node --test tests/
```

## Deploy

É uma PWA estática: basta servir os arquivos (ex.: GitHub Pages, Netlify, Vercel). A instalação ("Adicionar à tela inicial") exige um contexto seguro (HTTPS ou localhost).

## Estrutura

```
├── index.html      # HTML principal
├── css/styles.css  # Estilos (landscape-first)
├── js/engine.js    # Regras puras (sem DOM) — dicas e validação de jogadas
├── js/app.js       # Renderização e interações
├── js/sfx.js       # Efeitos sonoros procedurais (WebAudio, offline)
├── js/stats.js     # Estatísticas persistidas (localStorage)
├── js/winfx.js     # Cascata de vitória (canvas)
├── js/icons.js     # Ícones Lucide embutidos inline (ISC)
├── manifest.json   # PWA manifest
├── sw.js           # Service worker (cache-first, offline)
├── icons/          # Ícones do PWA gerados com scripts/make_icons.py
├── vendor/lucide/  # SVGs originais da biblioteca Lucide (referência/licença)
├── scripts/        # Gerador de ícones (PIL)
└── tests/          # Testes do motor e das estatísticas (node:test)
```

O service worker usa cache-first: ao atualizar arquivos, aumentar a versão em `sw.js` (`CACHE`) e a query de versão dos arquivos carregados (`?v=N` em `index.html`, `js/app.js` e no link do CSS) — assim o navegador não reutiliza a versão cacheada.
