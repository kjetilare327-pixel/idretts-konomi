import React from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Gift, Users } from 'lucide-react';
import ReferralDashboard from '../components/referral/ReferralDashboard';
import ReferralAdminPanel from '../components/referral/ReferralAdminPanel';

export default function ReferralProgram() {
  const { currentTeam, playerProfile, isTeamAdmin } = useTeam();
  const isAdmin = isTeamAdmin();

  if (!currentTeam) {
    return <div className="p-6">Laster...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Henvisningsprogram</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Henvis venner og få belønninger
        </p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="admin" className="space-y-6">
          <TabsList>
            <TabsTrigger value="admin">
              <Users className="w-4 h-4 mr-2" />
              Administrer
            </TabsTrigger>
            <TabsTrigger value="my">
              <Gift className="w-4 h-4 mr-2" />
              Mine henvisninger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin">
            <ReferralAdminPanel teamId={currentTeam.id} />
          </TabsContent>

          <TabsContent value="my">
            {playerProfile ? (
              <ReferralDashboard player={playerProfile} teamId={currentTeam.id} />
            ) : (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Du må være registrert som spiller for å bruke henvisningsprogrammet.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {playerProfile ? (
            <ReferralDashboard player={playerProfile} teamId={currentTeam.id} />
          ) : (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Du må være registrert som spiller for å bruke henvisningsprogrammet.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}