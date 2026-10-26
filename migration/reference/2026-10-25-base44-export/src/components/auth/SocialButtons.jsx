import React from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import GoogleIcon from "@/components/GoogleIcon";

// Reusable social login button row — Google, Apple, and Facebook.
// Instagram and TikTok are not available as auth providers on the
// platform; they are connected as posting connectors from the Social page.
const AppleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.03 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.93-.03-.01-2.72-1.04-2.75-4.12zM14.6 4.6c.71-.86 1.19-2.06 1.06-3.26-1.02.04-2.26.68-3 1.54-.66.76-1.24 1.98-1.08 3.16 1.14.09 2.31-.58 3.02-1.44z" />
  </svg>
);

const FacebookIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
  </svg>
);

export default function SocialButtons({ returnTo, label = "Continue with" }) {
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium"
        onClick={() => base44.auth.loginWithProvider("google", returnTo)}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        {label} Google
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 text-sm font-medium"
          onClick={() => base44.auth.loginWithProvider("apple", returnTo)}
        >
          <AppleIcon className="w-5 h-5 mr-2" />
          Apple
        </Button>
        <Button
          variant="outline"
          className="h-12 text-sm font-medium"
          onClick={() => base44.auth.loginWithProvider("facebook", returnTo)}
        >
          <FacebookIcon className="w-5 h-5 mr-2" />
          Facebook
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Social sign-in opens your IFund account. To publish to Facebook Pages,
        connect Facebook separately after signing in.
      </p>
    </div>
  );
}