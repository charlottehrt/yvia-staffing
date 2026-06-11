"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-5 w-8 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-colors",
        "data-checked:bg-primary data-unchecked:bg-input",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="size-4 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-3" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
