import { NextResponse } from "next/server";
import screens from "@/data/screens.json";
import { promises as fs } from "node:fs";
import path from "node:path";

type Screen = (typeof screens)[number];

function findScreen(id: string): Screen | undefined {
  return (screens as Screen[]).find((s) => s.id === id);
}

function pickI18n<T extends { zh: string; en: string }>(v: T, lang: "zh" | "en") {
  return lang === "en" ? v.en : v.zh;
}

type Scenario = "hdmi_cvt" | "lcd_show_driver";
function isScenario(v: unknown): v is Scenario {
  return v === "hdmi_cvt" || v === "lcd_show_driver";
}

function assertRot(rot: string): asserts rot is "0" | "90" | "180" | "270" {
  if (!["0", "90", "180", "270"].includes(rot)) {
    throw new Error("rot must be one of 0,90,180,270");
  }
}

function assertOs(os: string): void {
  // 需求里提到 Bookworm/Bullseye，这里仅做白名单校验（可扩展）
  const allowed = new Set(["bookworm64", "bookworm32", "bullseye64", "bullseye32"]);
  if (!allowed.has(os)) throw new Error("os not supported");
}

function assertLang(lang: string): asserts lang is "zh" | "en" {
  if (!["zh", "en"].includes(lang)) throw new Error("lang must be zh or en");
}

function inject(template: string, data: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(data)) {
    out = out.replaceAll(`__${k}__`, String(v));
  }
  return out;
}

async function loadCoreEngine(): Promise<string> {
  // Next.js 运行时：优先读项目内的 public/scripts/core_engine.sh
  const p = path.join(process.cwd(), "public", "scripts", "core_engine.sh");
  return await fs.readFile(p, "utf8");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const rot = url.searchParams.get("rot")?.trim() ?? "0";
    const os = url.searchParams.get("os")?.trim() ?? "bookworm64";
    const lang = url.searchParams.get("lang")?.trim() ?? "zh";

    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    assertRot(rot);
    assertOs(os);
    assertLang(lang);

    const screen = findScreen(id);
    if (!screen) return NextResponse.json({ error: "unknown screen id" }, { status: 404 });
    const screenName = pickI18n(screen.name, lang);
    const scenario: Scenario = isScenario(screen.scenario) ? screen.scenario : "hdmi_cvt";
    const hdmi = screen.hdmi ?? {
      hdmi_group: 0,
      hdmi_mode: 0,
      hdmi_drive: 0,
      hdmi_cvt: "",
    };

    const core = await loadCoreEngine();
    const script = inject(core, {
      SCREEN_ID: screen.id,
      SCREEN_NAME: screenName,
      OS_VARIANT: os,
      ROT_DEG: rot,
      LANG: lang,
      SCENARIO: scenario,
      HDMI_GROUP: hdmi.hdmi_group,
      HDMI_MODE: hdmi.hdmi_mode,
      HDMI_DRIVE: hdmi.hdmi_drive,
      HDMI_CVT: hdmi.hdmi_cvt,
      TOUCH_TYPE: screen.touch.type,
      LCDSHOW_REPO: screen.lcdShow?.repo ?? "",
      LCDSHOW_INSTALLER: screen.lcdShow?.installer ?? "",
      LCDSHOW_ROTARG: screen.lcdShow?.supportsRotationArg ? 1 : 0,
    });

    return NextResponse.json({
      id: screen.id,
      name: screenName,
      os,
      lang,
      scenario,
      rot: Number(rot),
      summary: {
        resolution: screen.resolution,
        hdmi: screen.hdmi,
        touch: {
          type: screen.touch.type,
          notes: pickI18n(screen.touch.notes, lang),
        },
        lcdShow: screen.lcdShow ?? null,
      },
      script,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

