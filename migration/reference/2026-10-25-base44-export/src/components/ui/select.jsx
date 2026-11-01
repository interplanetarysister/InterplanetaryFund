"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const SelectCloseCtx = React.createContext(() => {})

// Wrap Radix Root so the mobile bottom-sheet content can close itself via a
// "Done" button (Radix's DismissableLayer also closes on outside tap and on
// item select; this just guarantees a visible close affordance on phones).
const Select = ({ children, open: openProp, onOpenChange, ...props }) => {
  const [open, setOpen] = React.useState(false)
  const handleOpenChange = (o) => { setOpen(o); onOpenChange?.(o) }
  return (
    <SelectCloseCtx.Provider value={() => handleOpenChange(false)}>
      <SelectPrimitive.Root open={openProp ?? open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectCloseCtx.Provider>
  )
}

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 min-h-[44px] md:min-h-0 w-full min-w-0 max-w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:ring-offset-1 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-80 disabled:bg-muted/60 disabled:text-foreground [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>svg]:shrink-0",
      className
    )}
    {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", style, ...props }, ref) => {
  // On phones the options render as a full-width bottom sheet with large tap
  // rows instead of a small floating popover. Desktop keeps the popover.
  const isMobile = useIsMobile()
  const closeSelect = React.useContext(SelectCloseCtx)
  const mobileStyle = isMobile
    ? { position: "fixed", left: 0, right: 0, bottom: 0, top: "auto", width: "100%", maxWidth: "100%", transform: "none", maxHeight: "55vh" }
    : undefined

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-[min(24rem,calc(100dvh-1rem))] max-w-[calc(100vw-1rem)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" && !isMobile &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          isMobile && "rounded-b-none rounded-t-2xl border-x-0 border-b-0 pb-safe shadow-2xl data-[state=open]:slide-in-from-bottom-4",
          className
        )}
        position={position}
        style={{ ...style, ...mobileStyle }}
        {...props}>
        {isMobile && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Select</span>
            <button type="button" onClick={closeSelect} className="text-primary text-sm font-semibold min-h-[44px] px-2 -my-1">Done</button>
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn("p-1", isMobile ? "w-full" : position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)] max-w-full max-h-[min(18rem,60dvh)] overflow-y-auto")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full min-w-0 cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm leading-snug whitespace-normal break-words outline-none min-h-[44px] md:min-h-0 focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-70",
      className
    )}
    {...props}>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}