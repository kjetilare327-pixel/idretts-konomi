import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-6xl font-bold text-slate-200">404</h1>
          <p className="text-xl font-semibold mt-2">Siden ble ikke funnet</p>
          <p className="text-slate-500 mt-1">Beklager, vi finner ikke siden du leter etter.</p>
        </div>
        <Link to={createPageUrl('Dashboard')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <ArrowLeft className="w-4 h-4" /> Tilbake til dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}