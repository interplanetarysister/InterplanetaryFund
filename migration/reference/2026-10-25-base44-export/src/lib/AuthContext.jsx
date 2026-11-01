import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { getFrontendIdentity } from '@/lib/adminBootstrap';
import { isAndroidApp, disableAndroidPush } from '@/lib/androidFirebaseFeatures';
import { reportFrontendError } from '@/lib/platformErrorReporter';

const AuthContext = createContext();
const SAFE_APP_ERROR = 'Unable to load the application. Please try again.';
const APP_STATE_TIMEOUT_MS = 12000;
const AUTH_STATE_TIMEOUT_MS = 12000;

const withTimeout = (promise, timeoutMs, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = 'IFUND_BOOTSTRAP_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      const appClient = createAxiosClient({
        baseURL: appParams.appBaseUrl ? `${String(appParams.appBaseUrl).replace(/\/$/, '')}/api/apps/public` : `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token,
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`, { timeout: APP_STATE_TIMEOUT_MS });
        setAppPublicSettings(publicSettings);
        
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        if (![401,403].includes(Number(appError?.status))) reportFrontendError({source:'app_startup',kind:'request',error:appError,summary:'Application startup settings failed'});
        
        // Preserve intentional auth-state messages but never expose provider/server exception text.
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: SAFE_APP_ERROR
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: SAFE_APP_ERROR
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      reportFrontendError({source:'app_startup',kind:'request',error,summary:'Application bootstrap failed'});
      setAuthError({
        type: 'unknown',
        message: SAFE_APP_ERROR
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await withTimeout(base44.auth.me(), AUTH_STATE_TIMEOUT_MS, 'Authentication check');
      // Revoke access for an account whose deletion is in progress — the
      // backend state machine set account_deletion_pending before wiping data.
      if (currentUser?.account_deletion_pending) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
        base44.auth.logout();
        return;
      }
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      if (![401,403].includes(Number(error?.status))) reportFrontendError({source:'app_startup',kind:'request',error,summary:'Session verification failed unexpectedly'});
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      if (error.status === 401 || error.status === 403) {
        // The SDK's bearer is captured at app startup. If it has expired,
        // clear ONLY IFund's local session values and reload so the next SDK
        // instance is initialized without the revoked bearer. Calling
        // base44.auth.logout() here would navigate to the provider logout
        // endpoint and can trap users in a failed sign-in/redirect loop.
        if (appParams.token && typeof window !== 'undefined') {
          let cleared = false;
          try {
            window.localStorage.removeItem('base44_access_token');
            window.localStorage.removeItem('token');
            cleared = true;
          } catch { /* Continue to the login view without looping. */ }
          if (cleared) {
            window.location.reload();
            return;
          }
        }
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } else {
        // Never leave bootstrap on an infinite loading screen when the auth
        // provider is unavailable or a request stalls. Public routes can still
        // render and protected routes can offer retry/login recovery.
        setAuthError({
          type: 'auth_unavailable',
          message: SAFE_APP_ERROR
        });
      }
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (isAndroidApp) await disableAndroidPush().catch(() => {});

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const frontendIdentity = getFrontendIdentity(user);

  return (
    <AuthContext.Provider value={{ 
      user,
      frontendIdentity,
      isSuperAdmin: frontendIdentity.superAdminOwner, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};