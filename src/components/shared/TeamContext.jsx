import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await base44.auth.me();
      setUser(u);
      
      // Check if admin
      const allTeams = await base44.entities.Team.list();
      const adminTeams = allTeams.filter(t => 
        t.members?.some(m => m.email === u.email && m.role === 'admin')
      );
      setTeams(allTeams);
      setIsAdmin(adminTeams.length > 0);
      
      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      let selectedTeam = null;
      if (savedTeamId && allTeams.find(t => t.id === savedTeamId)) {
        selectedTeam = allTeams.find(t => t.id === savedTeamId);
      } else if (allTeams.length > 0) {
        selectedTeam = allTeams[0];
        localStorage.setItem('idrettsøkonomi_team_id', allTeams[0].id);
      }
      
      setCurrentTeam(selectedTeam);
      
      // Load player profile if exists
      if (selectedTeam) {
        const players = await base44.entities.Player.filter({ 
          team_id: selectedTeam.id, 
          user_email: u.email 
        });
        if (players.length > 0) setPlayerProfile(players[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectTeam = async (team) => {
    setCurrentTeam(team);
    localStorage.setItem('idrettsøkonomi_team_id', team.id);
    // Reload player profile for new team
    const players = await base44.entities.Player.filter({ 
      team_id: team.id, 
      user_email: user.email 
    });
    setPlayerProfile(players.length > 0 ? players[0] : null);
  };

  const refreshTeams = async () => {
    const allTeams = await base44.entities.Team.list();
    setTeams(allTeams);
    if (currentTeam) {
      const updated = allTeams.find(t => t.id === currentTeam.id);
      if (updated) setCurrentTeam(updated);
    }
  };

  const refreshPlayerProfile = async () => {
    if (!currentTeam || !user) return;
    const players = await base44.entities.Player.filter({ 
      team_id: currentTeam.id, 
      user_email: user.email 
    });
    setPlayerProfile(players.length > 0 ? players[0] : null);
  };

  const isTeamAdmin = (team = currentTeam) => {
    if (!team || !user) return false;
    return team.members?.some(m => m.email === user.email && m.role === 'admin');
  };

  return (
    <TeamContext.Provider value={{ 
      currentTeam, 
      teams, 
      loading, 
      user, 
      playerProfile,
      isAdmin,
      selectTeam, 
      refreshTeams, 
      refreshPlayerProfile,
      loadData,
      isTeamAdmin
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}