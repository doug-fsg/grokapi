import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { openCodeFreeModelsOverride } from "@/lib/env";

/**
 * Fila curta — free models falham/limitam; lista longa × timeout = scan “travado”.
 * Override: OPENCODE_FREE_MODELS=id1,id2
 */
export const DEFAULT_OPENCODE_FREE_MODELS = [
  "minimax-m3.1-flash-free",
  "deepseek-v4.1-flash-free",
  "glm-5.3-flash-free",
  "big-pickle",
  "iceman-free",
] as const;

/** Timeout por modelo — free models costumam demorar >40s no Windows. */
const MODEL_TIMEOUT_MS = Number(process.env.OPENCODE_MODEL_TIMEOUT_MS ?? 90_000);
/** Teto da cascade inteira (evita job rodar > recoverStuck). */
const CASCADE_BUDGET_MS = Number(process.env.OPENCODE_CASCADE_BUDGET_MS ?? 6 * 60_000);

export function resolveOpenCodeFreeModels(): string[] {
  const raw = openCodeFreeModelsOverride();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().replace(/^opencode\//, ""))
      .filter(Boolean)
      .slice(0, 8);
  }
  return [...DEFAULT_OPENCODE_FREE_MODELS];
}

export type CascadeAttempt = {
  model: string;
  ok: boolean;
  status?: number;
  error?: string;
};

export type CascadeResult = {
  content: string;
  model: string;
  tried: CascadeAttempt[];
};

export type CascadeProgress = {
  index: number;
  total: number;
  model: string;
  phase: "start" | "done" | "fail";
};

/**
 * No Windows, `spawn("opencode")` sem shell dá ENOENT (só existe .cmd/.ps1 no PATH).
 * Preferimos o .exe real do pacote npm global.
 */
function resolveOpenCodeBin(): { cmd: string; prefixArgs: string[]; useShell: boolean } {
  const override = (process.env.OPENCODE_BIN ?? "").trim();
  if (override) return { cmd: override, prefixArgs: [], useShell: false };

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    const candidates = [
      join(appData, "npm", "node_modules", "@opencode", "cli", "bin", "opencode.exe"),
      join(appData, "npm", "opencode.cmd"),
    ].filter(Boolean);
    for (const path of candidates) {
      if (path && existsSync(path)) {
        return { cmd: path, prefixArgs: [], useShell: path.endsWith(".cmd") };
      }
    }
    return { cmd: "opencode", prefixArgs: [], useShell: true };
  }

  return { cmd: "opencode", prefixArgs: [], useShell: false };
}

function killProcessTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    return;
  }
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

/** True se o binário `opencode` responde (free models só via CLI). */
export async function isOpenCodeCliReady(): Promise<boolean> {
  const { cmd, prefixArgs, useShell } = resolveOpenCodeBin();
  return new Promise((resolve) => {
    const child = spawn(cmd, [...prefixArgs, "--version"], {
      shell: useShell,
      env: { ...process.env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      killProcessTree(child);
      resolve(false);
    }, 15_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

function isFatalCliError(blob: string): boolean {
  return /enoent|not recognized|n[aã]o [eé] reconhecido|cannot find|no such file|is not recognized as/i.test(
    blob,
  );
}

function shouldFallbackCli(stderr: string, code: number | null): boolean {
  const blob = stderr.toLowerCase();
  if (code === 0) return false;
  if (isFatalCliError(blob)) return false;
  return (
    /free usage|rate.?limit|quota|capacity|overloaded|timeout|unavailable|not found|model|429|limit reached|subscribe/.test(
      blob,
    ) || code !== 0
  );
}

function stripCliNoise(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^>\s/.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function logCascade(...parts: unknown[]) {
  console.log("[pattern-scan]", ...parts);
}

function runOpenCodeCli(modelId: string, promptFile: string): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  ms: number;
}> {
  const { cmd, prefixArgs, useShell } = resolveOpenCodeBin();
  const model = modelId.startsWith("opencode/") ? modelId : `opencode/${modelId}`;
  const args = [
    ...prefixArgs,
    "run",
    "--model",
    model,
    "--format",
    "default",
    "--file",
    promptFile,
    "Leia o arquivo anexado e execute exatamente as instruções. Responda só com o resultado pedido, sem markdown extra.",
  ];
  const started = Date.now();

  return new Promise((resolve) => {
    logCascade(`CLI start model=${model} bin=${cmd} shell=${useShell} file=${promptFile}`);
    const child = spawn(cmd, args, {
      shell: useShell,
      env: { ...process.env },
      windowsHide: true,
      // Sem isso no Windows o CLI pode ficar à espera de stdin e nunca terminar.
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const finish = (result: {
      ok: boolean;
      stdout: string;
      stderr: string;
      code: number | null;
      timedOut: boolean;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, ms: Date.now() - started });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      logCascade(`CLI timeout model=${model} after ${MODEL_TIMEOUT_MS}ms — matando processo`);
      killProcessTree(child);
      finish({
        ok: false,
        stdout,
        stderr: stderr || "timeout",
        code: null,
        timedOut: true,
      });
    }, MODEL_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      finish({
        ok: false,
        stdout,
        stderr: `${err.message} (bin: ${cmd})`,
        code: 1,
        timedOut: false,
      });
    });
    child.on("close", (code) => {
      const cleaned = stripCliNoise(stdout);
      finish({
        ok: code === 0 && Boolean(cleaned) && !timedOut,
        stdout: cleaned,
        stderr,
        code,
        timedOut,
      });
    });
  });
}

/**
 * Cascade via OpenCode CLI (`opencode run`) — free models só liberam pelo cliente CLI.
 * Ordem: melhor → fallback em erro/limite. Teto de tempo na cascade.
 */
export async function chatWithOpenCodeCascade(input: {
  system: string;
  user: string;
  temperature?: number;
  acceptContent?: (content: string) => boolean;
  onAttempt?: (p: CascadeProgress) => void | Promise<void>;
}): Promise<CascadeResult> {
  const models = resolveOpenCodeFreeModels();
  if (!models.length) {
    throw new Error("Nenhum modelo free configurado (OPENCODE_FREE_MODELS).");
  }

  const prompt = `${input.system}\n\n---\n\n${input.user}`;
  const tmpDir = join(process.cwd(), ".tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  const promptName = `grokbot-playbook-${randomUUID()}.txt`;
  const promptFile = join(process.cwd(), ".tmp", promptName);
  await fs.writeFile(promptFile, prompt, "utf8");
  logCascade(
    `cascade start models=${models.length} [${models.join(", ")}] promptChars=${prompt.length} budget=${CASCADE_BUDGET_MS}ms timeout/model=${MODEL_TIMEOUT_MS}ms`,
  );

  const tried: CascadeAttempt[] = [];
  let lastErr = "todos os modelos free falharam via CLI";
  const cascadeStarted = Date.now();

  try {
    for (let i = 0; i < models.length; i++) {
      if (Date.now() - cascadeStarted > CASCADE_BUDGET_MS) {
        logCascade(`cascade budget esgotado após ${Date.now() - cascadeStarted}ms last=${lastErr}`);
        throw new Error(
          `Cascade OpenCode esgotou o tempo (${Math.round(CASCADE_BUDGET_MS / 1000)}s). Último: ${lastErr}`,
        );
      }
      const model = models[i]!;
      logCascade(`attempt ${i + 1}/${models.length} START model=${model}`);
      await input.onAttempt?.({
        index: i + 1,
        total: models.length,
        model,
        phase: "start",
      });
      const result = await runOpenCodeCli(model, promptFile);
      const errBlob = `${result.stderr}\n${result.stdout}`.slice(0, 500);
      if (!result.ok) {
        const shortErr =
          errBlob.trim().replace(/\s+/g, " ").slice(0, 220) ||
          (result.timedOut ? "timeout" : `exit ${result.code}`);
        tried.push({
          model,
          ok: false,
          error: shortErr,
        });
        lastErr = `${model}: ${shortErr.slice(0, 120)}`;
        logCascade(
          `attempt ${i + 1}/${models.length} FAIL model=${model} ms=${result.ms} code=${result.code} timedOut=${result.timedOut} err=${shortErr}`,
        );
        await input.onAttempt?.({
          index: i + 1,
          total: models.length,
          model,
          phase: "fail",
        });
        if (isFatalCliError(errBlob)) {
          throw new Error(
            `OpenCode CLI não encontrado (${lastErr}). Instale: npm i -g @opencode/cli e rode opencode auth login.`,
          );
        }
        if (shouldFallbackCli(errBlob, result.code) || result.timedOut) continue;
        throw new Error(`OpenCode CLI ${model}: ${lastErr}`);
      }
      const content = result.stdout.trim();
      if (input.acceptContent && !input.acceptContent(content)) {
        const preview = content.replace(/\s+/g, " ").slice(0, 180);
        tried.push({ model, ok: false, error: "conteúdo rejeitado (JSON inválido)" });
        lastErr = `${model}: conteúdo rejeitado`;
        logCascade(
          `attempt ${i + 1}/${models.length} REJECT model=${model} ms=${result.ms} preview=${preview}`,
        );
        await input.onAttempt?.({
          index: i + 1,
          total: models.length,
          model,
          phase: "fail",
        });
        continue;
      }
      tried.push({ model, ok: true });
      logCascade(
        `attempt ${i + 1}/${models.length} OK model=${model} ms=${result.ms} chars=${content.length}`,
      );
      await input.onAttempt?.({
        index: i + 1,
        total: models.length,
        model,
        phase: "done",
      });
      return { content, model, tried };
    }
  } finally {
    await fs.unlink(promptFile).catch(() => undefined);
  }

  logCascade(`cascade esgotada tried=${tried.length} last=${lastErr}`);
  throw new Error(
    `Cascade OpenCode CLI esgotada — ${lastErr}. Confirme: opencode --version e opencode auth login.`,
  );
}
