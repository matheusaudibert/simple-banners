# simple-banners

Gerador de banners simples para devs. Foto, título, subtítulo e sub-subtítulo, colagem de
imagens por cima e exportação em PNG — tudo no navegador.

## Rodando

```bash
npm install
npm run dev
```

Abre em <http://localhost:3000>.

## Como usar

Não tem painel de opções: edita-se direto no banner. Clicar em algo abre uma barrinha com o
que dá pra mudar naquilo.

- **Texto** — clique e escreva. A barra traz fonte e cor.
- **Imagem** — clique para trocar (arquivo ou link) e ajustar os cantos.
- **Fundo** — clique numa área vazia para escolher a cor.
- **Colagem** — arraste imagens para dentro do banner, posicione com o mouse e ajuste
  opacidade, rotação, cantos e ordem das camadas.
- **Baixar PNG** — exporta em 2400×1260. "Copiar" manda a imagem para a área de
  transferência.

O banner é sempre 1200×630, com tamanhos de fonte e espaçamentos fixos. O trabalho fica
salvo no navegador.

## Fontes

Inter, Anthropic Sans, Excalifont e JetBrains Mono, todas embutidas em `public/fonts`.

A "Anthropic Sans" usa a Styrene (a fonte do Claude) se ela estiver instalada na máquina;
como ela é proprietária e não pode ser redistribuída aqui, o padrão é a
[Figtree](https://fonts.google.com/specimen/Figtree), bem parecida.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4.

O preview é um `<canvas>` desenhado pelo mesmo código que gera o PNG, então o arquivo sai
igual ao que aparece na tela. As medidas fixas ficam no topo de `lib/presets.ts`.
