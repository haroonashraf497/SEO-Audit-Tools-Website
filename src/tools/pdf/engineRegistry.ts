/**
 * PDF engine registry — the one place that knows how the heaviest engines
 * (pdf-lib and friends) are split out of the tool-page chunk.
 *
 * Three callers stay in step through this module:
 *
 *  1. `src/utils/prefetch.ts` warms the engine chunk together with the route
 *     chunk, so opening a PDF tool normally commits with the engine already
 *     in memory.
 *  2. `PdfSwitch` (src/tools/Tools.tsx) resolves the engine component
 *     synchronously when it is cached, and otherwise waits — rendering an
 *     invisible, height-reserving box. It never renders a spinner or any
 *     loading text, and the tool page does not mount its below-the-body
 *     content until the engine is settled, so nothing visible can move after
 *     the page has painted (no layout shift).
 *  3. Failures still flow through `importWithRetry` → `RouteBoundary`, which
 *     offers "Try again" instead of a blank body.
 */
import type { ComponentType } from 'react';
import { importWithRetry } from '../../utils/lazyRetry';

export type PdfEngineModule = 'pdf' | 'convert';
type AnyComp = ComponentType<Record<string, unknown>>;
type EngineModule = Record<string, AnyComp>;

/** engine key → [chunk that exports it, exported component name]. */
export const PDF_ENGINES: Record<string, [PdfEngineModule, string]> = {
  'pdf-merge': ['pdf', 'MergePdf'], 'pdf-split': ['pdf', 'SplitPdf'], 'pdf-rotate': ['pdf', 'RotatePdf'], 'pdf-lock': ['pdf', 'LockPdf'], 'pdf-unlock': ['pdf', 'UnlockPdf'], 'pdf-compress': ['pdf', 'CompressPdf'],
  'text-to-pdf': ['convert', 'TextToPdf'], 'word-to-pdf': ['convert', 'WordToPdf'], 'pdf-to-word': ['convert', 'PdfToWord'], 'pdf-to-jpg': ['convert', 'PdfToJpg'], 'jpg-to-pdf': ['convert', 'JpgToPdf'], 'ppt-to-pdf': ['convert', 'PptToPdf'], 'excel-to-pdf': ['convert', 'ExcelToPdf'],
};

export interface PdfEngineSpec {
  /** The tool's engine key exactly as declared in the tool data. */
  key: string;
  /** Which split chunk holds the component. */
  mod: PdfEngineModule;
  /** Exported component name inside that chunk. */
  name: string;
  /** Extra props the engine key carries (`pdf-compress-500` → targetKb). */
  props: Record<string, unknown>;
}

/** Settled engine modules, so a second visit resolves without a network hop. */
const cache = new Map<PdfEngineModule, EngineModule>();
const inflight = new Map<PdfEngineModule, Promise<EngineModule>>();

/**
 * The engine spec for a tool's engine key, or null when the tool does not use a
 * split engine (its body is already in the tool-page chunk).
 */
export function pdfEngineSpec(engine: string | undefined): PdfEngineSpec | null {
  if (!engine) return null;
  // Size-targeted variants ("pdf-compress-500") reuse the base engine.
  const isTarget = engine.startsWith('pdf-compress-');
  const entry = isTarget ? PDF_ENGINES['pdf-compress'] : PDF_ENGINES[engine];
  if (!entry) return null;
  const target = isTarget ? Number(engine.split('-').pop()) : NaN;
  return {
    key: engine,
    mod: entry[0],
    name: entry[1],
    props: isTarget && Number.isFinite(target) ? { targetKb: target } : {},
  };
}

/** Load (once) the chunk holding an engine module; transient failures retry. */
export function loadPdfEngineModule(mod: PdfEngineModule): Promise<EngineModule> {
  const settled = cache.get(mod);
  if (settled) return Promise.resolve(settled);
  let pending = inflight.get(mod);
  if (!pending) {
    pending = importWithRetry<EngineModule>(() => (
      mod === 'pdf' ? import('./PdfTools') : import('./ConvertTools')
    ) as Promise<EngineModule>)
      .then(module => { cache.set(mod, module); inflight.delete(mod); return module; })
      .catch(error => { inflight.delete(mod); throw error; });
    inflight.set(mod, pending);
  }
  return pending;
}

/** Synchronous lookup: the component when its module is already loaded. */
export function pdfEngineComponent(spec: PdfEngineSpec): AnyComp | null {
  const module = cache.get(spec.mod);
  if (!module) return null;
  return (module[spec.name] as AnyComp) || null;
}
