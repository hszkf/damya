

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "~/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  colorScheme?: "redshift";
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, colorScheme = "redshift", ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "px-3 py-1.5 rounded-2xl",
      "text-xs font-medium",
      "text-on-surface-variant bg-transparent",
      "transition-all duration-150",
      "hover:bg-surface-container-high",
      "data-[state=active]:bg-redshift-container data-[state=active]:text-redshift",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("flex-1 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
