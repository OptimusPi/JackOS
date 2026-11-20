import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, X } from 'lucide-react';
import { BAL_TONES, BalSize, BalTone } from './tokens';

/* ============================================================================
 * BalButton — Authentic Balatro tactile button
 * Spec: Hover darkens face (0.88). Press sinks 4px & darkens further (0.74).
 * ============================================================================ */
export interface BalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: BalTone;
  size?: BalSize;
  block?: boolean;
  active?: boolean;
  disabledReason?: string;
}

const BUTTON_SIZE_CLASSES: Record<BalSize, string> = {
  xs: 'px-2 sm:px-2.5 py-1 text-[12px] sm:text-[13px] min-h-[28px]',
  sm: 'px-2.5 sm:px-3 py-1.5 text-[14px] sm:text-[15px] min-h-[34px]',
  md: 'px-3 sm:px-4 py-1.5 sm:py-2 text-[16px] sm:text-[18px] min-h-[40px]',
  lg: 'px-4 sm:px-5 py-2.5 text-[20px] sm:text-[22px] min-h-[48px]',
};

export const BalButton: React.FC<BalButtonProps> = ({
  tone = 'orange',
  size = 'md',
  block = false,
  active = false,
  disabled,
  disabledReason,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const palette = BAL_TONES[tone];
  return (
    <button
      type={type}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : rest.title}
      data-pressed={active ? 'true' : undefined}
      style={
        {
          '--bal-face': palette.face,
          '--bal-deep': palette.deep,
          '--bal-text': palette.text,
        } as React.CSSProperties
      }
      className={`bal-btn max-w-full min-w-0 ${block ? 'w-full' : 'inline-flex'} ${className}`}
      {...rest}
    >
      <span
        className={`bal-btn__face inline-flex w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis ${BUTTON_SIZE_CLASSES[size]}`}
      >
        {children}
      </span>
    </button>
  );
};

/* ============================================================================
 * BalPanel — Beveled Balatro frame (raised, inset, or green felt table)
 * ============================================================================ */
export interface BalPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  rightSlot?: React.ReactNode;
  variant?: 'raised' | 'inset' | 'felt';
}

export const BalPanel: React.FC<BalPanelProps> = ({
  title,
  rightSlot,
  variant = 'raised',
  className = '',
  children,
  ...rest
}) => {
  const surfaceClass =
    variant === 'inset'
      ? 'bg-[#223033] border-2 border-[#162022] shadow-[inset_0_2px_0_rgba(0,0,0,0.45)]'
      : variant === 'felt'
      ? 'bg-[#173c2f]/90 border-[3px] border-[#b9c2d2] border-b-[#6f7987] shadow-[0_4px_0_rgba(0,0,0,0.55)]'
      : 'bg-[#36494d] border-[3px] border-[#b9c2d2] border-b-[#6f7987] shadow-[0_4px_0_rgba(0,0,0,0.55)]';

  return (
    <div
      className={`w-full min-w-0 max-w-full rounded-[8px] p-2.5 sm:p-3 text-white ${surfaceClass} ${className}`}
      {...rest}
    >
      {(title != null || rightSlot != null) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
          {title != null && (
            <h3 className="m-0 min-w-0 text-[16px] sm:text-[18px] leading-tight tracking-wide text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
              {title}
            </h3>
          )}
          {rightSlot && <div className="flex flex-wrap items-center gap-1.5 max-w-full">{rightSlot}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

/* ============================================================================
 * BalChipCounter — Iconic Balatro [Blue Chips] × [Red Mult] scoreboard widget
 * ============================================================================ */
export interface BalChipCounterProps {
  leftLabel: string;
  leftValue: string | number;
  rightLabel: string;
  rightValue: string | number;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
}

export const BalChipCounter: React.FC<BalChipCounterProps> = ({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  footerLeft,
  footerRight,
}) => (
  <BalPanel variant="inset" className="flex flex-col gap-2">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <div className="rounded-[6px] bg-[#009dff] border-b-[4px] border-[#0068b8] px-2.5 py-1.5 text-right shadow-[0_3px_0_rgba(0,0,0,0.45)]">
        <div className="text-[11px] uppercase tracking-wider text-white/85 leading-none">
          {leftLabel}
        </div>
        <div className="text-[22px] leading-tight text-white tabular-nums [text-shadow:1px_1px_0_rgba(0,0,0,0.65)]">
          {leftValue}
        </div>
      </div>
      <span className="px-0.5 text-[22px] leading-none text-[#fe5f55] [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
        ×
      </span>
      <div className="rounded-[6px] bg-[#fe5f55] border-b-[4px] border-[#b8352e] px-2.5 py-1.5 text-left shadow-[0_3px_0_rgba(0,0,0,0.45)]">
        <div className="text-[11px] uppercase tracking-wider text-white/85 leading-none">
          {rightLabel}
        </div>
        <div className="text-[22px] leading-tight text-white tabular-nums [text-shadow:1px_1px_0_rgba(0,0,0,0.65)]">
          {rightValue}
        </div>
      </div>
    </div>
    {(footerLeft != null || footerRight != null) && (
      <div className="flex items-center justify-between text-[14px] tabular-nums">
        <span className="text-[#b7c7ca]">{footerLeft}</span>
        <span className="text-[#f5b841]">{footerRight}</span>
      </div>
    )}
  </BalPanel>
);

/* ============================================================================
 * BalCycle — Authentic Balatro ◀ Value ▶ selector with clickable pips & arrow keys
 * ============================================================================ */
export interface BalCycleOption<T extends string | number> {
  value: T;
  label: string;
}

export interface BalCycleProps<T extends string | number> {
  label: string;
  options: readonly BalCycleOption<T>[];
  value: T;
  onChange: (next: T) => void;
  tone?: BalTone;
  pips?: boolean;
  loop?: boolean;
  disabled?: boolean;
}

export function BalCycle<T extends string | number>({
  label,
  options,
  value,
  onChange,
  tone = 'red',
  pips,
  loop = true,
  disabled = false,
}: BalCycleProps<T>) {
  const id = useId();
  const count = options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const showPips = pips ?? (count > 1 && count <= 10);

  const step = (delta: number) => {
    if (disabled || count === 0) return;
    let next = index + delta;
    if (loop) next = (next + count) % count;
    else next = Math.min(count - 1, Math.max(0, next));
    if (next !== index && options[next]) onChange(options[next].value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <div
      role="group"
      aria-labelledby={id}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-1 focus-visible:outline-2 focus-visible:outline-[#f5b841] rounded-[6px]"
    >
      <span id={id} className="text-[13px] text-[#b7c7ca] leading-none">
        {label}
      </span>
      <div className="grid grid-cols-[34px_1fr_34px] items-center gap-1.5">
        <BalButton
          tone={tone}
          size="xs"
          disabled={disabled || (!loop && index === 0)}
          aria-label={`Previous ${label}`}
          onClick={() => step(-1)}
        >
          ◀
        </BalButton>

        <div className="flex flex-col items-center justify-center rounded-[6px] bg-[#1c282a] border-2 border-[#131c1e] px-2 py-1 min-h-[34px]">
          <span className="truncate max-w-full text-[16px] leading-none text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
            {options[index]?.label ?? '—'}
          </span>
          {showPips && count > 1 && (
            <div className="mt-1 flex items-center gap-1">
              {options.map((opt, i) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={disabled}
                  aria-label={`${label}: ${opt.label}`}
                  onClick={() => onChange(opt.value)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    i === index ? 'w-3 bg-[#f5b841]' : 'w-1.5 bg-white/25 hover:bg-white/55'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <BalButton
          tone={tone}
          size="xs"
          disabled={disabled || (!loop && index === count - 1)}
          aria-label={`Next ${label}`}
          onClick={() => step(1)}
        >
          ▶
        </BalButton>
      </div>
    </div>
  );
}

/* ============================================================================
 * BalSelect — Crisp Balatro dropdown with high z-index (never buried!)
 * ============================================================================ */
export interface BalSelectItem<T extends string> {
  value: T;
  label: string;
}

export interface BalSelectProps<T extends string> {
  label: string;
  items: readonly BalSelectItem<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function BalSelect<T extends string>({
  label,
  items,
  value,
  onChange,
  disabled = false,
}: BalSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const current = items.find((i) => i.value === value);
  const searchable = items.length > 10;

  const filteredItems =
    searchable && query.trim()
      ? items.filter((item) => {
          const q = query.trim().toLowerCase();
          return (
            item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
          );
        })
      : items;

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    if (searchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, searchable]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="text-[13px] text-[#b7c7ca] leading-none">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-[6px] border-2 border-[#b9c2d2] border-b-[#6f7987] bg-[#1e2b2d] px-3 py-1.5 text-left text-[16px] text-white shadow-[0_3px_0_rgba(0,0,0,0.45)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[#f5b841] disabled:opacity-50"
      >
        <span className="truncate">{current?.label ?? 'Choose…'}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#fe5f55] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[5000] rounded-[6px] border-2 border-[#b9c2d2] bg-[#2a3b3e] p-1 shadow-[0_6px_0_rgba(0,0,0,0.6)]">
          {searchable && (
            <div className="p-1 pb-1.5 border-b border-white/10">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${items.length} options…`}
                className="w-full rounded-[4px] border border-[#4f6367] bg-[#182426] px-2 py-1 text-[13px] text-white placeholder:text-[#7c9499] focus:outline-none focus:border-[#f5b841]"
              />
            </div>
          )}
          <ul role="listbox" className="max-h-[240px] overflow-y-auto pt-0.5">
            {filteredItems.length === 0 ? (
              <li className="px-2.5 py-2 text-[13px] text-[#b7c7ca] text-center">
                No match for “{query}”
              </li>
            ) : (
              filteredItems.map((item) => {
                const selected = item.value === value;
                return (
                  <li key={item.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-[4px] px-2.5 py-1.5 text-left text-[15px] transition-colors ${
                        selected
                          ? 'bg-[#fe5f55] text-white'
                          : 'text-white/90 hover:bg-[#3e5459]'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check size={14} className="shrink-0 text-[#f5b841]" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * BalSlider — Recessed Balatro track with colored fill & tabular readout
 * ============================================================================ */
export interface BalSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  tone?: BalTone;
  onChange: (value: number) => void;
}

export const BalSlider: React.FC<BalSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  tone = 'orange',
  onChange,
}) => {
  const id = useId();
  const pct = Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100));
  const fill = BAL_TONES[tone].face;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[14px]">
        <label htmlFor={id} className="text-[#b7c7ca]">
          {label}
        </label>
        <span className="tabular-nums text-[16px] text-[#f5b841]">{value}</span>
      </div>
      <div className="relative flex items-center h-5">
        <div className="w-full h-3 rounded-[4px] bg-[#182426] border-2 border-[#11191b] overflow-hidden shadow-[inset_0_2px_0_rgba(0,0,0,0.6)]">
          <div className="h-full" style={{ width: `${pct}%`, background: fill }} />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-3 rounded-[3px] border-2 border-white bg-[#2c3b3f] shadow-[0_2px_0_rgba(0,0,0,0.7)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ============================================================================
 * BalSwitch — Balatro chunky square checkbox/toggle
 * ============================================================================ */
export interface BalSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: BalTone;
}

export const BalSwitch: React.FC<BalSwitchProps> = ({
  label,
  checked,
  onChange,
  tone = 'green',
}) => {
  const palette = BAL_TONES[tone];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 py-0.5 text-left text-[15px] text-white hover:text-[#f5b841] focus-visible:outline-2 focus-visible:outline-[#f5b841] rounded-[4px] cursor-pointer"
    >
      <span className="truncate">{label}</span>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border-2 border-[#b9c2d2] transition-colors shadow-[0_2px_0_rgba(0,0,0,0.5)]"
        style={{ background: checked ? palette.face : '#1b272a' }}
      >
        {checked && <Check size={14} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  );
};

/* ============================================================================
 * BalTabs — Single-line Balatro segmented tab bar
 * ============================================================================ */
export interface BalTabOption<T extends string> {
  value: T;
  label: string;
}

export function BalTabs<T extends string>({
  tabs,
  value,
  onChange,
  tone = 'red',
  size = 'sm',
  className = '',
}: {
  tabs: readonly BalTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: BalTone;
  size?: BalSize;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={className || 'grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto'}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;
        return (
          <BalButton
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            tone={isActive ? tone : 'slate'}
            size={size}
            block={false}
            active={isActive}
            className="w-full sm:w-auto"
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </BalButton>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * BalInput & BalTextArea — Clean recessed fields + multi-line code editor
 * ============================================================================ */
export interface BalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  mono?: boolean;
  error?: string | null;
}

export const BalInput: React.FC<BalInputProps> = ({
  label,
  mono = false,
  error,
  className = '',
  ...rest
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-[13px] text-[#b7c7ca] leading-none">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full min-h-[38px] rounded-[6px] border-2 px-3 py-1.5 text-[15px] text-white bg-[#182426] placeholder:text-[#6f8387] focus:outline-none focus:border-[#f5b841] ${
          error ? 'border-[#fe5f55]' : 'border-[#4f6367]'
        } ${mono ? 'font-mono tracking-wider' : ''} ${className}`}
        {...rest}
      />
      {error && <span className="text-[13px] text-[#fe5f55]">{error}</span>}
    </div>
  );
};

export interface BalTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  mono?: boolean;
  error?: string | null;
}

export const BalTextArea: React.FC<BalTextAreaProps> = ({
  label,
  mono = true,
  error,
  className = '',
  ...rest
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-[13px] text-[#b7c7ca] leading-none">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full rounded-[6px] border-2 p-3 text-[13px] leading-relaxed text-white bg-[#151f21] placeholder:text-[#6f8387] focus:outline-none focus:border-[#f5b841] resize-y ${
          error ? 'border-[#fe5f55]' : 'border-[#4f6367]'
        } ${mono ? 'font-mono' : ''} ${className}`}
        {...rest}
      />
      {error && (
        <div className="rounded-[6px] border border-[#fe5f55] bg-[#fe5f55]/15 px-3 py-1.5 text-[14px] text-white">
          {error}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * BalSeedChip — Tap-to-copy Balatro seed card with Inspect button
 * ============================================================================ */
export const BalSeedChip: React.FC<{
  seed: string;
  score?: number;
  copied: boolean;
  onCopy: () => void;
  onInspect: () => void;
}> = ({ seed, score = 0, copied, onCopy, onInspect }) => (
  <div className="flex items-center justify-between gap-2 rounded-[6px] border-2 border-[#182426] bg-[#243437] px-3 py-2 shadow-[0_3px_0_rgba(0,0,0,0.45)]">
    <div className="min-w-0">
      <div className="font-mono text-[16px] font-semibold tracking-widest text-white truncate">
        {seed}
      </div>
      {score > 0 && (
        <div className="text-[12px] text-[#f5b841] tabular-nums">Score +{score}</div>
      )}
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <BalButton tone="blue" size="xs" onClick={onInspect}>
        Inspect
      </BalButton>
      <BalButton tone={copied ? 'green' : 'orange'} size="xs" onClick={onCopy} aria-label={`Copy ${seed}`}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </BalButton>
    </div>
  </div>
);

/* ============================================================================
 * BalDialog — Self-contained Balatro modal (zero broken portal CSS!)
 * ============================================================================ */
export const BalDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, description, children }) => {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/65 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-[10px] border-[3px] border-[#b9c2d2] border-b-[#6f7987] bg-[#36494d] p-4 text-white shadow-[0_8px_0_rgba(0,0,0,0.65)] flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="m-0 text-[24px] leading-none text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
              {title}
            </h2>
            {description && <p className="mt-1 text-[14px] text-[#b7c7ca]">{description}</p>}
          </div>
          <BalButton tone="red" size="xs" onClick={onClose} aria-label="Close dialog">
            <X size={14} />
          </BalButton>
        </div>

        <div className="text-[15px] leading-snug">{children}</div>

        <BalButton tone="orange" size="md" block onClick={onClose}>
          Back
        </BalButton>
      </div>
    </div>
  );
};
