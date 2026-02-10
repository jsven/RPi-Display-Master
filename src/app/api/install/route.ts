import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const rot = url.searchParams.get("rot") ?? "0";
  const os = url.searchParams.get("os") ?? "bookworm64";
  const lang = url.searchParams.get("lang") ?? "zh";

  const genUrl = new URL("/api/generate", url.origin);
  genUrl.searchParams.set("id", id);
  genUrl.searchParams.set("rot", rot);
  genUrl.searchParams.set("os", os);
  genUrl.searchParams.set("lang", lang);

  const res = await fetch(genUrl, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = (await res.json()) as { script: string };
  return new NextResponse(data.script, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

