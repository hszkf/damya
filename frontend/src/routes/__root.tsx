import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ThemeProvider } from '~/lib/theme-context';
import { ToastProvider } from '~/components/ui/toast-provider';
import { TooltipProvider } from '~/components/ui/tooltip';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <Outlet />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
