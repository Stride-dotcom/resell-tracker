import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'
import type { ItemStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'

const STATUS_STYLE: Record<ItemStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800',
  listed: 'bg-sky-100 text-sky-800',
  consigned: 'bg-amber-100 text-amber-800',
  sold: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-stone-200 text-stone-700',
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-4 ${className}`}>{children}</div>
  )
}

export function SectionTitle({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-500">
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-stone-500">{children}</label>
}

const fieldClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)]'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} min-h-[80px] ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />
}

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  className?: string
}

export function Button({ children, onClick, type = 'button', variant = 'secondary', disabled, className = '' }: BtnProps) {
  const styles: Record<string, string> = {
    primary: 'bg-[var(--color-brand)] text-white hover:opacity-90',
    secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
    ghost: 'text-stone-600 hover:bg-stone-100',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-[15px] text-stone-800">{children}</div>
    </div>
  )
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-xl text-stone-400">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16 text-stone-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-[var(--color-brand)]" />
    </div>
  )
}
