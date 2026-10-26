import React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

// Renders a standard centered modal on desktop and a bottom slide-up sheet
// (Vaul Drawer) on mobile, sharing one title + body. Keeps desktop modal
// sizing/behavior intact and gives phones a native sheet feel.
export default function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  desktopClassName = "sm:max-w-md rounded-2xl",
}) {
  const isMobile = useIsMobile();

  const header = isMobile ? (
    <DrawerHeader className="text-left relative">
      <button
        type="button"
        onClick={() => onOpenChange?.(false)}
        aria-label="Close"
        className="absolute right-3 top-3 w-9 h-9 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
      >
        <X className="w-5 h-5" />
      </button>
      <DrawerTitle className="font-display text-xl pr-10">{title}</DrawerTitle>
      {description ? <DrawerDescription>{description}</DrawerDescription> : null}
    </DrawerHeader>
  ) : (
    <DialogHeader>
      <DialogTitle className="font-display text-xl">{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent className="max-h-[88vh]">
          {header}
          <div className="px-4 pb-6 overflow-y-auto">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={desktopClassName}>
        {header}
        {children}
      </DialogContent>
    </Dialog>
  );
}