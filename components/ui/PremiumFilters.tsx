"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Minus, Plus } from "lucide-react";

type FilterOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type BaseFilterProps = {
  name?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  return ref;
}

export function PremiumSelect({
  name,
  label,
  value,
  defaultValue = "",
  options,
  disabled = false,
  className = "",
  onChange,
}: BaseFilterProps & {
  value?: string;
  defaultValue?: string;
  options: FilterOption[];
  onChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [open, setOpen] = useState(false);
  const currentValue = value ?? internalValue;
  const selectedOption =
    options.find((option) => option.value === currentValue) || options[0];
  const wrapperRef = useClickOutside(() => setOpen(false));

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  function selectValue(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      {label ? (
        <p className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-black/10 text-zinc-500"
            : "border-white/10 bg-black/20 text-white hover:border-[var(--brand)]/45 focus:border-[var(--brand)]/60"
        }`}
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label || "Selecione"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--brand-strong)] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#050b16] p-1 shadow-[0_22px_70px_rgba(0,0,0,0.65)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => selectValue(option.value)}
              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                option.value === currentValue
                  ? "bg-[var(--brand-muted)] text-white"
                  : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.value === currentValue ? (
                <Check className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "Selecionar data";
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function PremiumDatePicker({
  name,
  label,
  value,
  defaultValue = "",
  disabled = false,
  required = false,
  className = "",
  onChange,
}: BaseFilterProps & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = useState(value ?? defaultValue);
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const selectedValue = value ?? internalValue;
  const [displayMonth, setDisplayMonth] = useState(() => parseDate(selectedValue) || new Date());
  const todayValue = toDateValue(new Date());
  const days = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
      const parsed = parseDate(value);
      if (parsed) {
        setDisplayMonth(parsed);
      }
    }
  }, [value]);

  function commitValue(nextValue: string) {
    setInternalValue(nextValue);
    onChange?.(nextValue);

    const parsed = parseDate(nextValue);
    if (parsed) {
      setDisplayMonth(parsed);
    }
  }

  function moveMonth(offset: number) {
    setDisplayMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  }

  const calendarDialog =
    open && !disabled && isMounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={label || "Selecionar data"}
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#050b16] p-4 text-white shadow-[0_24px_90px_rgba(0,0,0,0.7)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                    {label || "Data"}
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold capitalize">
                    {formatMonthLabel(displayMonth)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label="Próximo mes"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
                  <span key={day} className="truncate">
                    {day}
                  </span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {days.map((date) => {
                  const dayValue = toDateValue(date);
                  const selected = dayValue === selectedValue;
                  const isToday = dayValue === todayValue;
                  const outsideMonth = date.getMonth() !== displayMonth.getMonth();

                  return (
                    <button
                      key={dayValue}
                      type="button"
                      onClick={() => {
                        commitValue(dayValue);
                        setOpen(false);
                      }}
                      className={`flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition ${
                        selected
                          ? "bg-[var(--brand)] text-white shadow-[0_12px_28px_rgba(14,165,233,0.28)]"
                          : isToday
                          ? "border border-[var(--brand)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]"
                          : outsideMonth
                          ? "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
                          : "text-zinc-200 hover:bg-white/[0.06]"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    commitValue("");
                    setOpen(false);
                  }}
                  className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitValue(todayValue);
                    setOpen(false);
                  }}
                  className="min-h-11 rounded-xl border border-[var(--brand)]/35 bg-[var(--brand-muted)] px-4 py-2 text-sm font-semibold text-[var(--brand-strong)] transition hover:brightness-110"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`.trim()}>
      {label ? (
        <p className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={selectedValue} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-black/10 text-zinc-500"
            : "border-white/10 bg-black/20 text-white hover:border-[var(--brand)]/45 focus:border-[var(--brand)]/60"
        }`}
      >
        <span className="min-w-0 truncate">{formatDateLabel(selectedValue)}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
      </button>

      {calendarDialog}
    </div>
  );
}

function parseDateTime(value: string) {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function formatDateTimeLabel(value: string) {
  const { date, time } = parseDateTime(value);
  const parsedDate = parseDate(date);

  if (!parsedDate && !time) return "Selecionar data e hora";
  if (!parsedDate) return time;

  return `${parsedDate.toLocaleDateString("pt-BR")} ${time || "--:--"}`;
}

function formatTimeLabel(value: string) {
  return value || "--:--";
}

const quickTimeOptions = ["08:00", "09:00", "10:00", "12:00", "14:00", "18:00"];

function clampTimePart(value: number, max: number) {
  if (value < 0) return max;
  if (value > max) return 0;
  return value;
}

function normalizeMinute(value: number) {
  return clampTimePart(value, 55);
}

function toTimePart(value: number) {
  return String(value).padStart(2, "0");
}

export function PremiumTimePicker({
  name,
  label,
  value,
  defaultValue = "",
  disabled = false,
  required = false,
  className = "",
  onChange,
}: BaseFilterProps & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const initial = value ?? defaultValue;
  const [internalValue, setInternalValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const selectedValue = value ?? internalValue;
  const [draftHour, setDraftHour] = useState(
    selectedValue ? selectedValue.slice(0, 2) : "08"
  );
  const [draftMinute, setDraftMinute] = useState(
    selectedValue ? selectedValue.slice(3, 5) : "00"
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
      if (value) {
        setDraftHour(value.slice(0, 2));
        setDraftMinute(value.slice(3, 5));
      }
    }
  }, [value]);

  function commitValue(nextHour = draftHour, nextMinute = draftMinute) {
    const nextValue = `${nextHour}:${nextMinute}`;
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  function moveHour(offset: number) {
    setDraftHour((current) => toTimePart(clampTimePart(Number(current) + offset, 23)));
  }

  function moveMinute(offset: number) {
    setDraftMinute((current) => toTimePart(normalizeMinute(Number(current) + offset)));
  }

  function selectQuickTime(time: string) {
    setDraftHour(time.slice(0, 2));
    setDraftMinute(time.slice(3, 5));
  }

  const dialog =
    open && !disabled && isMounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={label || "Selecionar horário"}
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#050b16] p-4 text-white shadow-[0_24px_90px_rgba(0,0,0,0.7)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--brand-strong)]">
                  {label || "Horário"}
                </p>
                <p className="mt-2 text-5xl font-black tracking-[-0.05em]">
                  {draftHour}
                  <span className="mx-1 text-[var(--brand-strong)]">:</span>
                  {draftMinute}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Hora
                  </p>
                  <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveHour(-1)}
                      className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      aria-label="Diminuir hora"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="text-center text-3xl font-black tracking-tight">
                      {draftHour}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveHour(1)}
                      className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      aria-label="Aumentar hora"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Minuto
                  </p>
                  <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveMinute(-5)}
                      className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      aria-label="Diminuir minuto"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="text-center text-3xl font-black tracking-tight">
                      {draftMinute}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveMinute(5)}
                      className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                      aria-label="Aumentar minuto"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Atalhos
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {quickTimeOptions.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => selectQuickTime(time)}
                      className={`min-h-10 rounded-xl border px-2 text-sm font-bold transition ${
                        `${draftHour}:${draftMinute}` === time
                          ? "border-[var(--brand)]/55 bg-[var(--brand-muted)] text-[var(--brand-strong)]"
                          : "border-white/10 bg-black/20 text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => commitValue()}
                  className="min-h-11 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`.trim()}>
      {label ? (
        <p className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={selectedValue} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-black/10 text-zinc-500"
            : "border-white/10 bg-black/25 text-white hover:border-[var(--brand)]/45 focus:border-[var(--brand)]/60"
        }`}
      >
        <span>{formatTimeLabel(selectedValue)}</span>
        <Clock3 className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {dialog}
    </div>
  );
}

export function PremiumDateTimePicker({
  name,
  label,
  value,
  defaultValue = "",
  disabled = false,
  required = false,
  className = "",
  onChange,
}: BaseFilterProps & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const initial = value ?? defaultValue;
  const [internalValue, setInternalValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const selectedValue = value ?? internalValue;
  const selectedParts = parseDateTime(selectedValue);
  const [draftDate, setDraftDate] = useState(selectedParts.date);
  const [draftTime, setDraftTime] = useState(selectedParts.time);
  const [displayMonth, setDisplayMonth] = useState(
    () => parseDate(selectedParts.date) || new Date()
  );
  const todayValue = toDateValue(new Date());
  const days = useMemo(() => getCalendarDays(displayMonth), [displayMonth]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
      const nextParts = parseDateTime(value);
      setDraftDate(nextParts.date);
      setDraftTime(nextParts.time);

      const parsed = parseDate(nextParts.date);
      if (parsed) {
        setDisplayMonth(parsed);
      }
    }
  }, [value]);

  function commitValue(nextDate = draftDate, nextTime = draftTime) {
    const nextValue = nextDate && nextTime ? `${nextDate}T${nextTime}` : "";
    setInternalValue(nextValue);
    onChange?.(nextValue);
    setOpen(false);
  }

  function moveMonth(offset: number) {
    setDisplayMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  }

  const dialog =
    open && !disabled && isMounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={label || "Selecionar data e hora"}
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#050b16] p-4 text-white shadow-[0_24px_90px_rgba(0,0,0,0.7)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                    {label || "Período"}
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold capitalize">
                    {formatMonthLabel(displayMonth)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label="Próximo mes"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
                  <span key={day} className="truncate">
                    {day}
                  </span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {days.map((date) => {
                  const dayValue = toDateValue(date);
                  const selected = dayValue === draftDate;
                  const isToday = dayValue === todayValue;
                  const outsideMonth = date.getMonth() !== displayMonth.getMonth();

                  return (
                    <button
                      key={dayValue}
                      type="button"
                      onClick={() => setDraftDate(dayValue)}
                      className={`flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition ${
                        selected
                          ? "bg-[var(--brand)] text-white shadow-[0_12px_28px_rgba(14,165,233,0.28)]"
                          : isToday
                          ? "border border-[var(--brand)]/45 bg-[var(--brand-muted)] text-[var(--brand-strong)]"
                          : outsideMonth
                          ? "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
                          : "text-zinc-200 hover:bg-white/[0.06]"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-zinc-300">Horário</span>
                <input
                  type="time"
                  value={draftTime}
                  onChange={(event) => setDraftTime(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand)]/60"
                />
              </label>

              <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraftDate("");
                    setDraftTime("");
                    setInternalValue("");
                    onChange?.("");
                    setOpen(false);
                  }}
                  className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setDraftDate(todayValue);
                    setDraftTime(
                      `${String(now.getHours()).padStart(2, "0")}:${String(
                        now.getMinutes()
                      ).padStart(2, "0")}`
                    );
                    setDisplayMonth(now);
                  }}
                  className="min-h-11 rounded-xl border border-[var(--brand)]/35 bg-[var(--brand-muted)] px-4 py-2 text-sm font-semibold text-[var(--brand-strong)] transition hover:brightness-110"
                >
                  Agora
                </button>
                <button
                  type="button"
                  onClick={() => commitValue()}
                  disabled={!draftDate || !draftTime}
                  className="min-h-11 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`.trim()}>
      {label ? (
        <p className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </p>
      ) : null}
      {name ? <input type="hidden" name={name} value={selectedValue} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-black/10 text-zinc-500"
            : "border-white/10 bg-black/20 text-white hover:border-[var(--brand)]/45 focus:border-[var(--brand)]/60"
        }`}
      >
        <span className="min-w-0 truncate">{formatDateTimeLabel(selectedValue)}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-strong)]" />
      </button>

      {dialog}
    </div>
  );
}
