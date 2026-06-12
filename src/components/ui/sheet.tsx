"use client";
// Panneau latéral (drawer) qui glisse depuis la droite. Bâti sur la primitive
// Dialog de base-ui, comme le composant Dialog, mais positionné sur le bord droit.

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

const SHEET_CONTENT_BASE_CLASSNAME =
  "fixed inset-y-0 z-50 flex h-full w-full flex-col gap-4 overflow-y-auto bg-popover p-5 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-closed:animate-out";

type SheetSide = "right" | "left";

// Positionnement + largeur par côté. À droite (défaut) : largeur uniforme des
// drawers d'entité. À gauche : panneau de navigation mobile, plus étroit.
const SHEET_CONTENT_SIDE_CLASSNAME: Record<SheetSide, string> = {
  right: "right-0 data-open:slide-in-from-right data-closed:slide-out-to-right",
  left: "left-0 data-open:slide-in-from-left data-closed:slide-out-to-left",
};

const SHEET_CONTENT_WIDTH_CLASSNAME: Record<SheetSide, string> = {
  right: "max-w-2xl",
  left: "max-w-72",
};

type SheetContentClassName = DialogPrimitive.Popup.Props["className"];
type SheetContentState = DialogPrimitive.Popup.State;

function getSheetContentClassName(
  className?: SheetContentClassName,
  side: SheetSide = "right"
): SheetContentClassName {
  if (typeof className === "function") {
    return (state: SheetContentState) =>
      cn(
        SHEET_CONTENT_BASE_CLASSNAME,
        SHEET_CONTENT_SIDE_CLASSNAME[side],
        className(state),
        SHEET_CONTENT_WIDTH_CLASSNAME[side]
      );
  }

  return cn(
    SHEET_CONTENT_BASE_CLASSNAME,
    SHEET_CONTENT_SIDE_CLASSNAME[side],
    className,
    SHEET_CONTENT_WIDTH_CLASSNAME[side]
  );
}

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  side = "right",
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean; side?: SheetSide }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        // forceRender : voile rendu même si le panneau est imbriqué dans un
        // autre dialog, pour griser ce qui se trouve derrière à chaque niveau.
        forceRender
        className="fixed inset-0 z-50 bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={getSheetContentClassName(className, side)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 pr-8", className)} {...props} />;
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-display text-xl leading-tight", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 border-t pt-4", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter, getSheetContentClassName };
