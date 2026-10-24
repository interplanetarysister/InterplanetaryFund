import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import CreateCampaign from './pages/CreateCampaign';
import CampaignDetail from './pages/CampaignDetail';
import MyGiving from './pages/MyGiving';
import Communications from './pages/Communications';
import MissionControlPage from './pages/MissionControlPage';
import Community from './pages/Community';
import CommunityDetail from './pages/CommunityDetail';
import Institutions from './pages/Institutions';
import InstitutionDetail from './pages/InstitutionDetail';
import Analytics from './pages/Analytics';
import Platform from './pages/Platform';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Connections from './pages/Connections';
import Inbox from './pages/Inbox';
import FollowedCampaigns from './pages/FollowedCampaigns';
import Notifications from './pages/Notifications';
import Subscriptions from './pages/Subscriptions';
import Withdrawals from './pages/Withdrawals';
import GlobalGlobe from './pages/GlobalGlobe';
import EmbedCampaign from './pages/EmbedCampaign';
import Agents from './pages/Agents';
import OpsCenter from './pages/OpsCenter';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/globe" element={<GlobalGlobe />} />
      <Route path="/embed/campaign/:id" element={<EmbedCampaign />} />
      {/* Public campaign page — anyone arriving from a shared link can read the
          story and donate without signing in. */}
      <Route element={<Layout />}>
        <Route path="/campaign/:id" element={<CampaignDetail />} />
      </Route>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        {/* Full-screen onboarding experience, outside the Layout chrome */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/giving" element={<MyGiving />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/mission" element={<MissionControlPage />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<CommunityDetail />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/institutions/:id" element={<InstitutionDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/following" element={<FollowedCampaigns />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/withdrawals" element={<Withdrawals />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/ops" element={<OpsCenter />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/platform" element={<Platform />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  // Sync the app theme with the device system color scheme so the Android
  // WebView picks up dark mode automatically — on startup and on change.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e) => document.documentElement.classList.toggle("dark", e.matches);
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App