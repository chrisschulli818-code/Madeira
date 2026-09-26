/**
 * Campos de formulário reutilizáveis do painel de parâmetros.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/** Input numérico que só confirma o valor ao sair do campo ou teclar Enter (permite digitar livremente). */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'mm',
  className,
  id,
  'aria-label': ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (!Number.isFinite(n)) return setDraft(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        type="number"
        step={step}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="h-8 w-full rounded-md border border-border bg-surface pl-2 pr-8 text-right text-sm tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {unit && <span className="pointer-events-none absolute right-2 text-xs text-subtle">{unit}</span>}
    </div>
  );
}

/** Slider + input numérico sincronizados. */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'mm',
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-subtle">
          {label}
        </label>
        <NumberInput id={id} value={value} onChange={onChange} min={min} max={max} step={step} unit={unit} className="w-24" />
      </div>
      <Slider
        aria-label={label}
        value={[Math.min(max, Math.max(min, value))]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => v !== undefined && onChange(v)}
      />
      {hint && <p className="text-[11px] leading-snug text-subtle">{hint}</p>}
    </div>
  );
}

/** Linha "rótulo à esquerda, controle à direita". */
export function FieldRow({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-subtle">{label}</span>
        {children}
      </div>
      {hint && <p className="text-[11px] leading-snug text-subtle">{hint}</p>}
    </div>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

/** Controle segmentado (grupo de botões de opção exclusiva). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-md bg-muted p-0.5', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors',
            o.value === value ? 'bg-surface text-foreground shadow-sm' : 'text-subtle hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Contador com botões − / +. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  'aria-label': ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  'aria-label'?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-surface" aria-label={ariaLabel} role="group">
      <button
        type="button"
        aria-label="Diminuir"
        className="grid size-7 place-items-center text-subtle hover:text-foreground disabled:opacity-30"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Aumentar"
        className="grid size-7 place-items-center text-subtle hover:text-foreground disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Seleção de espessura com valores comerciais + campo personalizado. */
export function ThicknessPicker({
  value,
  onChange,
  presets,
  extra,
}: {
  value: number;
  onChange: (v: number) => void;
  presets: number[];
  /** Opção adicional (ex.: "= caixa"). */
  extra?: { label: string; value: number };
}) {
  const options: SegmentOption<string>[] = presets.map((p) => ({ value: String(p), label: `${p}` }));
  if (extra && !presets.includes(extra.value)) options.push({ value: 'extra', label: extra.label });
  const current = presets.includes(value) ? String(value) : extra && value === extra.value ? 'extra' : '';
  return (
    <div className="flex items-center gap-2">
      <Segmented
        options={options}
        value={current}
        onChange={(v) => onChange(v === 'extra' ? extra!.value : Number(v))}
      />
      <NumberInput value={value} onChange={onChange} min={3} max={50} className="w-20" aria-label="Espessura personalizada" />
    </div>
  );
}

/** Seção recolhível do painel lateral. */
export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="text-primary [&_svg]:size-4">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 text-subtle transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}
