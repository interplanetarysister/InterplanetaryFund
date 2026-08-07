import { Link } from 'react-router-dom';
import { Check, Heart, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-[#0B0F0E] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30">
          <Check className="w-8 h-8 text-[#0B0F0E]" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Thank you for your generosity</h1>
        <p className="text-stone-400 text-sm leading-relaxed mb-8">
          Your donation has been received. Every contribution makes a real difference. A receipt and thank-you message will be on their way.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/discover">
            <Button variant="outline" className="border-white/10 bg-white/[0.03] gap-2 w-full sm:w-auto">
              <Compass className="w-4 h-4" /> Browse more causes
            </Button>
          </Link>
          <Link to="/">
            <Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 w-full sm:w-auto">
              <Heart className="w-4 h-4" /> Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}