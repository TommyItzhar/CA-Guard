import * as React from 'react';
import { cn } from '../../utils/cn';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

// ─── Button ───────────────────────────────────────────────────────────────────
const buttonVariants: Record<string, string> = {
  default: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  ghost: 'text-gray-700 hover:bg-gray-100',
  link: 'text-indigo-600 underline-offset-4 hover:underline p-0 h-auto',
  success: 'bg-green-600 text-white hover:bg-green-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
};

const buttonSizes: Record<string, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-7 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// ─── Badge ────────────────────────────────────────────────────────────────────
const badgeVariants: Record<string, string> = {
  default: 'bg-indigo-100 text-indigo-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  secondary: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof badgeVariants;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border bg-white shadow-sm', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-gray-900', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// ─── Textarea ─────────────────────────────────────────────────────────────────
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

// ─── Label ────────────────────────────────────────────────────────────────────
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-gray-700', className)} {...props} />;
}

// ─── Select ───────────────────────────────────────────────────────────────────
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

// ─── Dialog ───────────────────────────────────────────────────────────────────
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', className)}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
        'rounded-lg border bg-white p-6 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-gray-900', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-gray-500', className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-3 mt-6', className)} {...props} />;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn('fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-[380px] flex-col gap-2', className)}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: 'default' | 'success' | 'error';
  className?: string;
  children?: React.ReactNode;
}

export const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between rounded-lg border p-4 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full',
        {
          'bg-white border-gray-200': variant === 'default',
          'bg-green-50 border-green-200': variant === 'success',
          'bg-red-50 border-red-200': variant === 'error',
        },
        className
      )}
      {...props}
    />
  )
);
Toast.displayName = 'Toast';

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
));
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-sm text-gray-600', className)} {...props} />
));
ToastDescription.displayName = 'ToastDescription';

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn('absolute right-2 top-2 rounded p-0.5 opacity-60 hover:opacity-100', className)}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = 'ToastClose';
