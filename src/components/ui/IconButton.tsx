import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name is required; the children should be aria-hidden. */
  label: string
  ref?: Ref<HTMLButtonElement>
  children: ReactNode
}

export function IconButton({
  label,
  ref,
  children,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={['icon-button', className].filter(Boolean).join(' ')}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  )
}
