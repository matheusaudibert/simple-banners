import { NextResponse } from "next/server";

/**
 * Busca imagens externas pelo servidor para que elas cheguem ao navegador
 * como same-origin. Sem isso, um link sem CORS (ou com redirecionamento,
 * como github.com/user.png) "suja" o canvas e impede a exportação do PNG.
 */

const MAX_BYTES = 20 * 1024 * 1024;

const BLOCKED_HOST =
  /^(localhost|127(\.\d+){3}|0\.0\.0\.0|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|169\.254(\.\d+){2}|\[?::1\]?|.*\.local)$/i;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "parâmetro url obrigatório" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "url inválida" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "protocolo não suportado" }, { status: 400 });
  }
  if (BLOCKED_HOST.test(parsed.hostname)) {
    return NextResponse.json({ error: "host não permitido" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "image/*" },
    });
  } catch {
    return NextResponse.json({ error: "não consegui buscar a imagem" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `origem respondeu ${upstream.status}` }, { status: 502 });
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "o link não aponta para uma imagem" }, { status: 415 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "imagem grande demais" }, { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=3600",
      "content-length": String(buffer.byteLength),
    },
  });
}
