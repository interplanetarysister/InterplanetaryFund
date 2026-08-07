import { Component } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F0E] text-stone-100 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-5">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-stone-500 mb-6">An unexpected error occurred. You can try again or head back to the dashboard.</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.reset} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl">
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
              <Link to="/">
                <Button variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl">
                  <Home className="w-4 h-4" /> Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}