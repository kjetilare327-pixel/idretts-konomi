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
      
      // Only load teams this user is a member of
      const allTeams = await base44.entities.Team.list();
      const myTeams = allTeams.filter(t =>
        t.created_by === u.email ||
        t.members?.some(m => m.email === u.email)
      );
      const adminTeams = myTeams.filter(t =>
        t.members?.some(m => m.email === u.email && m.role === 'admin')
      );
      setTeams(myTeams);
      setIsAdmin(adminTeams.length > 0);
      
      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      let selectedTeam = null;
      if (savedTeamId && myTeams.find(t => t.id === savedTeamId)) {
        selectedTeam = myTeams.find(t => t.id === savedTeamId);
      } else if (myTeams.length > 0) {
        selectedTeam = myTeams[0];
        localStorage.setItem('idrettsøkonomi_team_id', myTeams[0].id);
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
    return team.members?.some(m => m.email === user.email && ['admin', 'kasserer', 'styreleder', 'revisor'].includes(m.role));
  };

  // RBAC: get current user's role in the current team
  const getUserTeamRole = (team = currentTeam) => {
    if (!team || !user) return 'player';
    const member = team.members?.find(m => m.email === user.email);
    return member?.role || 'player';
  };

  // RBAC: check if user can access finance data (not just a parent/player viewing own debts)
  const canViewFinance = (team = currentTeam) => {
    const role = getUserTeamRole(team);
    return ['admin', 'kasserer', 'styreleder', 'revisor'].includes(role);
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
      isTeamAdmin,
      getUserTeamRole,
      canViewFinance,
    }}>
      {children}
    </TeamContext.Provider>
  );
}

// isParentRole: true if the user is a 'parent' in the current team (RBAC helper)
export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}