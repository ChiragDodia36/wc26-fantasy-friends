/**
 * On-device LLM inference using llama.rn (llama.cpp React Native binding).
 * Runs Qwen3 0.6B locally with streaming thinking traces.
 */
import { getModelPath } from './modelManager';
import type { TransferContext, TransferSwap } from '@/types/ai';

// llama.rn requires a native build — gracefully handle Expo Go where the module is unavailable.
let llamaModule: any = null;
try {
  // Dynamic require — will throw in Expo Go since there's no native module
  llamaModule = require('llama.rn');
} catch (_e) {
  // llama.rn not available (running in Expo Go) — AI features disabled
  console.warn('llama.rn not available. On-device AI requires a native dev build (npx expo run:ios).');
}

type LlamaContext = any;
let context: LlamaContext | null = null;

/** Check if llama.rn native module is available (i.e. running in a dev build, not Expo Go). */
export function isLlamaAvailable(): boolean {
  return !!llamaModule?.initLlama;
}

/** Initialise the llama.rn context (lazy, call once). */
export async function initModel(): Promise<void> {
  if (context) return;
  if (!llamaModule?.initLlama) {
    throw new Error(
      'llama.rn is not available. AI features require a native dev build (npx expo run:ios).',
    );
  }
  context = await llamaModule.initLlama({
    model: getModelPath(),
    n_ctx: 8192,
    n_gpu_layers: 99, // Metal on iOS, OpenCL/Vulkan on Android
    use_mlock: true,
  });
}

/** Release model resources. */
export async function releaseModel(): Promise<void> {
  if (context) {
    await context.release();
    context = null;
  }
}

export function isModelLoaded(): boolean {
  return context !== null;
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a fantasy football transfer advisor. Given a squad and candidates, suggest 3 transfers.

RULES:
- Remove the 3 squad players with the lowest avg_form
- Replace each with the highest avg_form candidate of the SAME position (GK/DEF/MID/FWD)
- Use the EXACT player names from the input lists
- Budget: sum of (out_price - in_price) must be >= 0

OUTPUT: reply with ONLY this JSON (no markdown, no explanation):
{"swaps":[{"out_name":"EXACT name from SQUAD","in_name":"EXACT name from CANDIDATES","reason":"form X.X→Y.Y"},{"out_name":"...","in_name":"...","reason":"..."},{"out_name":"...","in_name":"...","reason":"..."}],"summary":"3 transfers to boost form","confidence":70}`;

function formatContext(ctx: TransferContext): string {
  const lines: string[] = [];
  lines.push(`Budget: £${ctx.budget_remaining.toFixed(1)}m`);

  // Squad — compact format
  lines.push('\nSQUAD:');
  for (const p of ctx.squad_players) {
    lines.push(`${p.name} (${p.position}) £${p.price.toFixed(1)}m avg=${p.avg_form}`);
  }

  // Candidates — top 15 by form to keep prompt short
  const sorted = [...ctx.candidate_players].sort((a, b) => b.avg_form - a.avg_form).slice(0, 15);
  lines.push('\nCANDIDATES:');
  for (const p of sorted) {
    lines.push(`${p.name} (${p.position}) £${p.price.toFixed(1)}m avg=${p.avg_form} ${p.team_name ?? ''}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Streaming inference
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onThinkingToken: (token: string) => void;
  onAnswerToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (err: Error) => void;
}

/**
 * Run transfer suggestion inference with streaming token callbacks.
 * Parses `<think>...</think>` boundaries to separate reasoning from answer.
 */
export async function suggestTransfers(
  transferContext: TransferContext,
  callbacks: StreamCallbacks,
): Promise<void> {
  if (!context) {
    callbacks.onError(new Error('Model not initialised. Call initModel() first.'));
    return;
  }

  const userMessage = formatContext(transferContext);

  let fullText = '';
  let insideThink = false;
  let thinkBuffer = '';

  try {
    await context.completion(
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        n_predict: 512,
        temperature: 0.1,
        top_p: 0.9,
        stop: ['</s>', '<|endoftext|>', '<|im_end|>'],
      },
      (data: any) => {
        const token = data.token;
        fullText += token;

        // Track <think> / </think> boundaries
        if (!insideThink) {
          thinkBuffer += token;
          if (thinkBuffer.includes('<think>')) {
            insideThink = true;
            // Emit any content after <think> tag
            const afterTag = thinkBuffer.split('<think>').pop() ?? '';
            if (afterTag) callbacks.onThinkingToken(afterTag);
            thinkBuffer = '';
          }
        } else {
          thinkBuffer += token;
          if (thinkBuffer.includes('</think>')) {
            // Emit content before </think> tag
            const beforeTag = thinkBuffer.split('</think>')[0];
            if (beforeTag) callbacks.onThinkingToken(beforeTag);
            insideThink = false;
            // Any content after </think> is the answer
            const afterTag = thinkBuffer.split('</think>').slice(1).join('');
            if (afterTag) callbacks.onAnswerToken(afterTag);
            thinkBuffer = '';
          } else {
            // Stream thinking tokens as they arrive (flush when buffer is big enough)
            if (thinkBuffer.length > 10) {
              callbacks.onThinkingToken(thinkBuffer);
              thinkBuffer = '';
            }
          }
        }
      },
    );

    // Flush any remaining buffer
    if (thinkBuffer) {
      if (insideThink) {
        callbacks.onThinkingToken(thinkBuffer);
      } else {
        callbacks.onAnswerToken(thinkBuffer);
      }
    }

    callbacks.onComplete(fullText);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Parse the JSON answer from the model's output (after </think>).
 * Handles raw JSON, markdown code blocks, and truncated output.
 */
export function parseTransferAnswer(fullText: string): {
  swaps: TransferSwap[];
  summary: string;
  confidence: number;
} | null {
  // Extract everything after </think>
  const parts = fullText.split('</think>');
  const answer = parts.length > 1 ? parts.slice(1).join('') : fullText;

  // Try to find JSON object
  const jsonMatch = answer.match(/\{[\s\S]*"swaps"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const swaps = normalizeSwaps(parsed.swaps);
      if (swaps.length > 0) {
        return { swaps, summary: parsed.summary ?? '', confidence: parsed.confidence ?? 50 };
      }
    } catch {
      // JSON might be truncated — try to fix it
      const fixed = tryFixTruncatedJson(jsonMatch[0]);
      if (fixed) {
        const swaps = normalizeSwaps(fixed.swaps);
        if (swaps.length > 0) {
          return { swaps, summary: fixed.summary ?? '', confidence: fixed.confidence ?? 50 };
        }
      }
    }
  }

  // Fallback: extract swaps from thinking text using pattern matching
  return extractSwapsFromText(fullText);
}

function normalizeSwaps(raw: any[]): TransferSwap[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => ({
    out: s.out ?? s.player_out ?? s.out_id ?? '',
    in: s.in ?? s.player_in ?? s.in_id ?? '',
    out_name: s.out_name ?? s.player_out_name ?? s.from_name ?? s.out ?? '',
    in_name: s.in_name ?? s.player_in_name ?? s.to_name ?? s.in ?? '',
    reason: s.reason ?? s.reasoning ?? '',
  }));
}

/** Try to fix truncated JSON by closing brackets/braces. */
function tryFixTruncatedJson(json: string): any | null {
  // Try progressively adding closing characters
  const suffixes = ['"}]}', '"}],"summary":"","confidence":50}', '],"summary":"","confidence":50}', '"}', '"]};', '}'];
  for (const suffix of suffixes) {
    try {
      const candidate = json + suffix;
      return JSON.parse(candidate);
    } catch { /* try next */ }
  }
  // Try extracting just the swaps array
  const swapsMatch = json.match(/"swaps"\s*:\s*\[([\s\S]*)/);
  if (swapsMatch) {
    const arrStr = '[' + swapsMatch[1];
    // Try closing the array
    for (const suffix of ['"}]', ']', '"}]}']) {
      try {
        const arr = JSON.parse(arrStr + suffix);
        if (Array.isArray(arr)) return { swaps: arr, summary: '', confidence: 50 };
      } catch { /* try next */ }
    }
  }
  return null;
}

/** Fallback: extract swap suggestions from the thinking/reasoning text. */
function extractSwapsFromText(text: string): {
  swaps: TransferSwap[];
  summary: string;
  confidence: number;
} | null {
  const swaps: TransferSwap[] = [];

  // Try numbered pattern first (e.g., "1. Swap A. Player (DEF) with B. Player (MID)")
  const numberedRegex = /(\d+)\.\s*(?:Swap\s+)?([A-Z][.\w\s'-]+?)\s*\((\w+)\)\s*(?:with|→|->|for)\s*([A-Z][.\w\s'-]+?)\s*\((\w+)\)/gi;
  let match;
  while ((match = numberedRegex.exec(text)) !== null) {
    swaps.push({
      out: '', in: '',
      out_name: match[2].trim(),
      in_name: match[4].trim(),
      reason: `${match[3]} → ${match[5]} position swap`,
    });
  }

  if (swaps.length > 0) {
    return {
      swaps: swaps.slice(0, 3),
      summary: 'Extracted from AI reasoning (JSON was incomplete)',
      confidence: 40,
    };
  }

  // Try simpler pattern
  const simpleRegex = /(?:swap|replace)\s+([A-Z][.\w\s'-]{2,25}?)\s+(?:with|for)\s+([A-Z][.\w\s'-]{2,25}?)(?:\.|,|\n)/gi;
  while ((match = simpleRegex.exec(text)) !== null) {
    swaps.push({
      out: '', in: '',
      out_name: match[1].trim(),
      in_name: match[2].trim(),
      reason: 'AI suggested swap',
    });
  }

  if (swaps.length > 0) {
    return {
      swaps: swaps.slice(0, 3),
      summary: 'Extracted from AI reasoning (JSON was incomplete)',
      confidence: 30,
    };
  }

  return null;
}
