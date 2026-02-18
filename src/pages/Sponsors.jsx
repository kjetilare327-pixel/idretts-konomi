import React from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SponsorManager from '@/components/sponsors/SponsorManager';
import AISponsorAdvisor from '@/components/sponsors/AISponsorAdvisor';

export default function Sponsors() {
  const { currentTeam } = useTeam();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
    staleTime: 5 * 60 * 1000,
  });

  if (!currentTeam) return <p className="text-center py-12 text-slate-500">Velg et lag for å se sponsorer.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sponsorer & Tilskudd</h1>
        <p className="text-sm text-slate-500">Administrer sponsoravtaler, tilskudd og betalingsoppfølging</p>
      </div>

      <AISponsorAdvisor sponsors={[]} transactions={transactions} teamName={currentTeam.name} />
      <SponsorManager teamId={currentTeam.id} />
    </div>
  );
}