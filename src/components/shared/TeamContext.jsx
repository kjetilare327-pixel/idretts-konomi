import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      const allTeams = await base44.entities.Team.list();
      setTeams(allTeams);
      
      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      if (savedTeamId && allTeams.find(t => t.id === savedTeamId)) {
        setCurrentTeam(allTeams.find(t => t.id === savedTeamId));
      } else if (allTeams.length > 0) {
        setCurrentTeam(allTeams[0]);
        localStorage.setItem('idrettsøkonomi_team_id', allTeams[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectTeam = (team) => {
    setCurrentTeam(team);
    localStorage.setItem('idrettsøkonomi_team_id', team.id);
  };

  const refreshTeams = async () => {
    const allTeams = await base44.entities.Team.list();
    setTeams(allTeams);
    if (currentTeam) {
      const updated = allTeams.find(t => t.id === currentTeam.id);
      if (updated) setCurrentTeam(updated);
    }
  };

  return (
    <TeamContext.Provider value={{ currentTeam, teams, loading, user, selectTeam, refreshTeams, loadData }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}