import React, { useId, useState } from 'react';
import {
  Badge,
  Button,
  Cycle,
  Dialog,
  Panel,
  Select,
  Slider,
  Switch,
  Tab,
  TabList,
  Tabs,
  TextField,
  Tooltip,
  TooltipProvider,
  type Tone as JamlTone,
} from 'jaml-ui';
import { Check, Copy } from 'lucide-react';
import { BalSize, BalTone } from './tokens';

export { Badge, Tooltip, TooltipProvider };

function toJamlTone(tone: BalTone): JamlTone {
  if (tone === 'gold') return 'orange';
  if (tone === 'slate') return 'blue';
  return tone;
}

/* ============================================================================
 * BalButton — Thin adapter over jaml-ui <Button>
 * ============================================================================ */
export interface BalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: BalTone;
  size?: BalSize;
  block?: boolean;
  active?: boolean;
  disabledReason?: string;
}

export const BalButton: React.FC<BalButtonProps> = ({
  tone = 'orange',
  size = 'md',
  block = false,
  active = false,
  disabled,
  disabledReason,
  className = '',
  children,
  ...rest
}) => {
  const resolvedTone = tone as BalTone;
  const customToneAttr = resolvedTone === 'gold' || resolvedTone === 'slate' ? resolvedTone : undefined;
  return (
    <Button
      tone={toJamlTone(resolvedTone)}
      size={size}
      block={block}
      disabled={disabled}
      disabledReason={disabledReason}
      data-pressed={active ? '' : undefined}
      data-bal-tone={customToneAttr}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
};

/* ============================================================================
 * BalPanel — Thin adapter over jaml-ui <Panel>
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
  const panelVariant = variant === 'inset' ? 'inset' : 'raised';
  const hasCustomHeader = rightSlot != null || (title != null && typeof title !== 'string');

  return (
    <Panel
      variant={panelVariant}
      title={hasCustomHeader ? undefined : title}
      data-felt={variant === 'felt' ? 'true' : undefined}
      className={`w-full min-w-0 max-w-full ${className}`}
      {...rest}
    >
      {hasCustomHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/10">
          {title != null && (
            <h3 className="m-0 min-w-0 text-[17px] leading-tight tracking-wide text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
              {title}
            </h3>
          )}
          {rightSlot && (
            <div className="flex flex-wrap items-center gap-1.5 max-w-full">{rightSlot}</div>
          )}
        </div>
      )}
      {children}
    </Panel>
  );
};

/* ============================================================================
 * BalChipCounter — Compact Balatro readout on jaml-ui inset <Panel>
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
  <Panel variant="inset" className="w-full">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <div className="rounded-[6px] bg-[var(--j-blue)] border-b-[3px] border-[var(--j-blue-deep)] px-2.5 py-1.5 text-right">
        <div className="text-[11px] uppercase tracking-wider text-white/85 leading-none">
          {leftLabel}
        </div>
        <div className="text-[20px] leading-tight text-white tabular-nums [text-shadow:1px_1px_0_rgba(0,0,0,0.65)]">
          {leftValue}
        </div>
      </div>
      <span className="px-0.5 text-[20px] leading-none text-[var(--j-red)] [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
        ×
      </span>
      <div className="rounded-[6px] bg-[var(--j-red)] border-b-[3px] border-[var(--j-red-deep)] px-2.5 py-1.5 text-left">
        <div className="text-[11px] uppercase tracking-wider text-white/85 leading-none">
          {rightLabel}
        </div>
        <div className="text-[20px] leading-tight text-white tabular-nums [text-shadow:1px_1px_0_rgba(0,0,0,0.65)]">
          {rightValue}
        </div>
      </div>
    </div>
    {(footerLeft != null || footerRight != null) && (
      <div className="flex items-center justify-between text-[13px] tabular-nums">
        <span className="text-[var(--j-text-muted)]">{footerLeft}</span>
        <span className="text-[var(--j-gold)]">{footerRight}</span>
      </div>
    )}
  </Panel>
);

/* ============================================================================
 * BalCycle — Direct adapter over jaml-ui <Cycle>
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
  return (
    <Cycle<T>
      label={label}
      options={options}
      value={value}
      onValueChange={onChange}
      tone={toJamlTone(tone)}
      pips={pips}
      loop={loop}
      disabled={disabled}
      className="w-full"
    />
  );
}

/* ============================================================================
 * BalSelect — Direct adapter over jaml-ui <Select> (@base-ui/react)
 * ============================================================================ */
export interface BalSelectItem<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface BalSelectProps<T extends string> {
  label?: string;
  items: readonly BalSelectItem<T>[];
  value: T;
  onChange: (val: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BalSelect<T extends string>({
  label,
  items,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
}: BalSelectProps<T>) {
  return (
    <Select<T>
      label={label ?? ''}
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full min-w-0"
    />
  );
}

/* ============================================================================
 * BalSlider — Direct adapter over jaml-ui <Slider> (@base-ui/react)
 * ============================================================================ */
export interface BalSliderProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tone?: BalTone;
  hideValue?: boolean;
  disabled?: boolean;
}

export const BalSlider: React.FC<BalSliderProps> = ({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
  step = 1,
  tone = 'red',
  hideValue = false,
  disabled = false,
}) => (
  <Slider
    label={label}
    tone={toJamlTone(tone as BalTone)}
    value={value}
    onValueChange={(next) => {
      if (typeof next === 'number') onChange(next);
    }}
    min={min}
    max={max}
    step={step}
    hideValue={hideValue}
    disabled={disabled}
    className="w-full"
  />
);

/* ============================================================================
 * BalSwitch — Direct adapter over jaml-ui <Switch> (@base-ui/react)
 * ============================================================================ */
export interface BalSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: BalTone;
  disabled?: boolean;
}

export const BalSwitch: React.FC<BalSwitchProps> = ({
  label,
  checked,
  onChange,
  tone = 'red',
  disabled = false,
}) => (
  <Switch
    label={label}
    tone={toJamlTone(tone as BalTone)}
    checked={checked}
    onCheckedChange={onChange}
    disabled={disabled}
  />
);

/* ============================================================================
 * BalTabs — Direct adapter over jaml-ui <Tabs> with bouncing Balatro arrow
 * ============================================================================ */
export interface BalTabOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export function BalTabs<T extends string>({
  tabs,
  value,
  onChange,
  tone = 'red',
  size = 'sm',
  className = '',
  compact = false,
}: {
  tabs: readonly BalTabOption<T>[];
  value: T;
  onChange: (val: T) => void;
  tone?: BalTone;
  size?: BalSize;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Tabs
      tone={toJamlTone(tone)}
      size={size}
      value={value}
      onValueChange={(val) => {
        if (typeof val === 'string') onChange(val as T);
      }}
      className={`${compact ? 'j-tabs--compact' : ''} ${className}`}
    >
      <TabList aria-label="View Tabs">
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value}>
            {tab.label}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
}

/* ============================================================================
 * BalInput — Direct adapter over jaml-ui <TextField> (@base-ui/react)
 * ============================================================================ */
export interface BalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  mono?: boolean;
}

export const BalInput: React.FC<BalInputProps> = ({
  label,
  error,
  mono = false,
  className = '',
  ...rest
}) => (
  <TextField
    label={label ?? ''}
    error={error ?? undefined}
    mono={mono}
    className={`w-full min-w-0 ${className}`}
    {...rest}
  />
);

/* ============================================================================
 * BalTextArea — Styled with jaml-ui CSS tokens
 * ============================================================================ */
export interface BalTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
}

export const BalTextArea: React.FC<BalTextAreaProps> = ({
  label,
  error,
  className = '',
  ...rest
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1 w-full min-w-0">
      {label && (
        <label
          htmlFor={id}
          className="text-[13px] tracking-wide text-[var(--j-text-muted)] [text-shadow:1px_1px_0_var(--j-text-shadow)]"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={`w-full rounded-[6px] border-[3px] bg-[var(--j-surface-inset)] px-2.5 py-2 font-mono text-[13px] text-[var(--j-text)] placeholder:text-[var(--j-text-muted)]/60 focus:outline-none ${
          error
            ? 'border-[var(--j-red)]'
            : 'border-[var(--j-border)] focus:border-[var(--j-focus)]'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-[12px] text-[var(--j-red)]">{error}</span>}
    </div>
  );
};

/* ============================================================================
 * BalSeedChip — Copy-on-click monospace seed chip
 * ============================================================================ */
export const BalSeedChip: React.FC<{
  seed: string;
  score?: number;
  onCopy?: () => void;
}> = ({ seed, score, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(seed).catch(() => {});
    setCopied(true);
    onCopy?.();
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Button tone={copied ? 'green' : 'blue'} size="xs" onClick={handleCopy}>
      <span className="font-mono tracking-widest">{seed}</span>
      {typeof score === 'number' && score > 0 && (
        <span className="text-[var(--j-gold)]">+{score}</span>
      )}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </Button>
  );
};

/* ============================================================================
 * BalDialog — Direct adapter over jaml-ui <Dialog> (@base-ui/react)
 * ============================================================================ */
export const BalDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, description, children }) => (
  <Dialog
    open={open}
    onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}
    title={title}
    description={description}
    backLabel="Close"
    backTone="orange"
  >
    {children}
  </Dialog>
);
