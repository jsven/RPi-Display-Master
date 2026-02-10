"use client";

import { useEffect, useMemo, useState } from "react";
import screensData from "@/data/screens.json";
import {
  Check,
  Copy,
  Cpu,
  Languages,
  Monitor,
  RotateCw,
  Terminal,
  Touchpad,
  Loader2,
} from "lucide-react";

type Screen = (typeof screensData)[number];

type OsVariant = "bookworm64" | "bookworm32" | "bullseye64" | "bullseye32";
type Rot = 0 | 90 | 180 | 270;
type Lang = "zh" | "en";

const OS_IDS: OsVariant[] = ["bookworm64", "bookworm32", "bullseye32", "bullseye64"];

const ROT_IDS: Rot[] = [0, 90, 180, 270];

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const I18N = {
  zh: {
    product: "RPi-Display Master",
    tagline: "一行命令搞定非标 HDMI 屏幕：分辨率 + 旋转 + 触摸校准",
    intro: "选择屏幕型号、系统版本与旋转方向，自动生成可执行脚本（带备份与幂等写入）。",
    step1: "第一步：选择屏幕型号",
    step2: "第二步：选择系统版本",
    step3: "第三步：选择旋转方向",
    generate: "生成一键执行命令",
    generating: "正在生成…",
    safeHint: "会自动备份 config.txt 并幂等写入参数",
    result: "结果",
    oneLine: "一键执行指令",
    copy: "复制",
    summary: "参数摘要",
    scriptPreview: "生成的脚本（预览）",
    touch: "触摸",
    resolution: "分辨率",
    rotation: "旋转",
    screen: "屏幕",
    hdmiCvt: "hdmi_cvt",
    copyDone: "已复制",
    scenario: {
      hdmi_cvt: "HDMI 自定义时序（写入 config.txt）",
      lcd_show_driver: "LCD-show 驱动安装（克隆仓库并执行安装脚本）",
    },
    lcdShowInstaller: "LCD-show 安装脚本",
    os: {
      bookworm64: { name: "Raspberry Pi OS Bookworm 64位", hint: "较新（默认 Wayland）" },
      bookworm32: { name: "Raspberry Pi OS Bookworm 32位", hint: "兼容性更好" },
      bullseye32: { name: "Raspberry Pi OS Bullseye 32位", hint: "较旧（X11 常见）" },
      bullseye64: { name: "Raspberry Pi OS Bullseye 64位", hint: "较旧（64 位）" },
    },
    rotHint: {
      0: "默认",
      90: "顺时针",
      180: "倒置",
      270: "逆时针",
    },
  },
  en: {
    product: "RPi-Display Master",
    tagline: "Fix non-standard HDMI displays in one line: resolution + rotation + touch",
    intro: "Select your screen, OS variant, and rotation to generate an executable script (with backup & idempotency).",
    step1: "Step 1: Select screen model",
    step2: "Step 2: Select OS variant",
    step3: "Step 3: Select rotation",
    generate: "Generate one-line command",
    generating: "Generating…",
    safeHint: "Automatically backs up config.txt and writes settings idempotently",
    result: "Result",
    oneLine: "One-line command",
    copy: "Copy",
    summary: "Tech summary",
    scriptPreview: "Generated script (preview)",
    touch: "Touch",
    resolution: "Resolution",
    rotation: "Rotation",
    screen: "Screen",
    hdmiCvt: "hdmi_cvt",
    copyDone: "Copied",
    scenario: {
      hdmi_cvt: "HDMI custom timing (write config.txt)",
      lcd_show_driver: "LCD-show driver install (clone repo + run installer)",
    },
    lcdShowInstaller: "LCD-show installer",
    os: {
      bookworm64: { name: "Raspberry Pi OS Bookworm 64-bit", hint: "Newer (Wayland by default)" },
      bookworm32: { name: "Raspberry Pi OS Bookworm 32-bit", hint: "Better compatibility" },
      bullseye32: { name: "Raspberry Pi OS Bullseye 32-bit", hint: "Older (often X11)" },
      bullseye64: { name: "Raspberry Pi OS Bullseye 64-bit", hint: "Older (64-bit)" },
    },
    rotHint: {
      0: "Default",
      90: "Clockwise",
      180: "Upside down",
      270: "Counter-clockwise",
    },
  },
} as const;

function screenIcon(tags: string[]) {
  if (tags.includes("round")) return <Monitor className="h-5 w-5" />;
  if (tags.includes("bar")) return <Monitor className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

export default function Home() {
  const screens = (screensData as Screen[]).slice();
  const [lang, setLang] = useState<Lang>("zh");
  const [screenId, setScreenId] = useState<Screen["id"]>(screens[0]?.id ?? "88bar");
  const [os, setOs] = useState<OsVariant>("bookworm64");
  const [rot, setRot] = useState<Rot>(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    cmd: string;
    summary?: unknown;
    script?: string;
  } | null>(null);

  const t = I18N[lang];

  useEffect(() => {
    // 语言优先级：URL ?lang= > localStorage > 默认 zh
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("lang");
    const saved = window.localStorage.getItem("rpidsm_lang");
    const initial = (q === "en" || q === "zh" ? q : saved === "en" || saved === "zh" ? saved : "zh") as Lang;
    setLang(initial);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rpidsm_lang", lang);
  }, [lang]);

  const screen = useMemo(() => screens.find((s) => s.id === screenId), [screens, screenId]);
  const scenario = (screen?.scenario ?? "hdmi_cvt") as "hdmi_cvt" | "lcd_show_driver";

  const installUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL("/api/install", window.location.origin);
    u.searchParams.set("id", screenId);
    u.searchParams.set("rot", String(rot));
    u.searchParams.set("os", os);
    u.searchParams.set("lang", lang);
    return u.toString();
  }, [screenId, rot, os, lang]);

  const oneLineCmd = useMemo(() => {
    if (!installUrl) return "";
    return `curl -sL "${installUrl}" | sudo bash`;
  }, [installUrl]);

  async function onGenerate() {
    setIsGenerating(true);
    try {
      const params = new URLSearchParams({
        id: screenId,
        rot: String(rot),
        os,
        lang,
      });
      const res = await fetch(`/api/generate?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { script?: string; summary?: unknown };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "生成失败");
      setGenerated({ cmd: oneLineCmd, summary: data.summary, script: data.script });
    } finally {
      setIsGenerating(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Cpu className="h-4 w-4" />
              <span>{t.product}</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <Languages className="h-4 w-4 text-zinc-500" />
                <button
                  type="button"
                  onClick={() => setLang("zh")}
                  className={classNames(
                    "rounded-lg px-2 py-1 transition",
                    lang === "zh"
                      ? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30",
                  )}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={classNames(
                    "rounded-lg px-2 py-1 transition",
                    lang === "en"
                      ? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30",
                  )}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.tagline}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            {t.intro}
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <section className="lg:col-span-7">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{t.step1}</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {screens.map((s) => {
                  const selected = s.id === screenId;
                  const screenName = lang === "en" ? s.name.en : s.name.zh;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setScreenId(s.id)}
                      className={classNames(
                        "group rounded-xl border p-4 text-left transition",
                        selected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900/30"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={classNames(
                              "rounded-lg p-2",
                              selected
                                ? "bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
                            )}
                          >
                            {screenIcon(s.tags)}
                          </div>
                          <div>
                            <div className="font-medium">{screenName}</div>
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                              {s.resolution.width}×{s.resolution.height} · {t.touch}{" "}
                              {s.touch.type.toUpperCase()}
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {t.scenario[(s.scenario ?? "hdmi_cvt") as "hdmi_cvt" | "lcd_show_driver"]}
                            </div>
                          </div>
                        </div>
                        {selected ? <Check className="h-5 w-5" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{t.step2}</h2>
              </div>
              <div className="mt-4 grid gap-3">
                {OS_IDS.map((id) => {
                  const selected = id === os;
                  const o = t.os[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setOs(id)}
                      className={classNames(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                        selected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900/30"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                      )}
                    >
                      <div>
                        <div className="font-medium">{o.name}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{o.hint}</div>
                      </div>
                      {selected ? <Check className="h-5 w-5" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <RotateCw className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{t.step3}</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {ROT_IDS.map((r) => {
                  const selected = r === rot;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRot(r)}
                      className={classNames(
                        "rounded-xl border px-3 py-4 text-center transition",
                        selected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900/30"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                      )}
                    >
                      <div className="text-lg font-semibold">{r}°</div>
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {t.rotHint[r]}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!screen || isGenerating}
                  className={classNames(
                    "inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white",
                  )}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isGenerating ? t.generating : t.generate}
                </button>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t.safeHint}{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">config.txt</code>
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{t.result}</h2>
              </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {t.oneLine}
                </div>
                <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-50">
                  {oneLineCmd || "（启动后将自动生成）"}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(oneLineCmd)}
                    disabled={!oneLineCmd}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900/30"
                  >
                    <Copy className="h-4 w-4" />
                    {t.copy}
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Touchpad className="h-4 w-4" />
                  {t.summary}
                </div>
                <div className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">{t.screen}</span>
                    <span className="text-right font-medium">
                      {screen ? (lang === "en" ? screen.name.en : screen.name.zh) : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">{t.resolution}</span>
                    <span className="font-mono">
                      {screen ? `${screen.resolution.width}×${screen.resolution.height}` : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">{t.rotation}</span>
                    <span className="font-mono">{rot}°</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400">{t.touch}</span>
                    <span className="font-mono">{screen?.touch.type.toUpperCase() ?? "-"}</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 dark:border-zinc-800 dark:bg-zinc-900/20">
                    {scenario === "lcd_show_driver" ? (
                      <>
                        <div className="font-medium text-zinc-600 dark:text-zinc-300">
                          {t.lcdShowInstaller}
                        </div>
                        <div className="mt-1 font-mono">{screen?.lcdShow?.installer ?? "-"}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-zinc-600 dark:text-zinc-300">hdmi_cvt</div>
                        <div className="mt-1 font-mono">{screen?.hdmi?.hdmi_cvt ?? "-"}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {generated?.script ? (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-sm font-semibold">{t.scriptPreview}</div>
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 dark:border-zinc-800 dark:bg-zinc-900/20">
                  {generated.script}
                </pre>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
