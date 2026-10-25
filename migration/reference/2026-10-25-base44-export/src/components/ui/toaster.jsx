import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { campaignActionDestination, safeActionRoute } from "@/lib/actionDestinations";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const navigate = useNavigate();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, actionContext, actionLabel, ...props }) {
        const destination = actionContext?.path
          ? safeActionRoute(actionContext.path)
          : campaignActionDestination(actionContext);
        return (
          <Toast key={id} {...props}>
            {destination ? (
              <button type="button" className="min-w-0 flex-1 text-left rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => { dismiss(id); navigate(destination); }}
                aria-label={actionLabel || "Open related campaign action"}>
                <span className="grid gap-1">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && <ToastDescription>{description}</ToastDescription>}
                </span>
              </button>
            ) : (
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            )}
            {action}
            {destination && (
              <button
                type="button"
                className="shrink-0 rounded-lg border border-current/30 px-3 py-2 text-xs font-semibold hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => { dismiss(id); navigate(destination); }}
                aria-label={actionLabel || "Open related campaign action"}
              >
                {actionLabel || "Open action"}
              </button>
            )}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}