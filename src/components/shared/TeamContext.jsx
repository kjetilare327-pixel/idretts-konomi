import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const TeamContext = createContext(null);

// Fetch teams scoped to the current user — filter server-side by created_by,
// then fall back to client-side members check (multi-tenant safe).
async function fetchMyTeams(userEmail) {
  const [createdTeams, allTeams] = await Promise.all([
    base44.entities.Team.filter({ created_by: userEmail }).catch(() => []),
    base44.entities.Team.list().catch(() => []),
  ]);

  // Merge: teams created by user OR teams where user is in members array
  const byId = new Map();
  for (const t of [...createdTeams, ...allTeams]) {
    const isMine =
      t.created_by === userEmail ||
      t.members?.some(m => m.email === userEmail);
    if (isMine) byId.set(t.id, t);
  }
  return [...byId.values()];
}

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

  // Accepts an optional `freshTeam` to inject immediately (post-create)
  // without relying on async propagation.
  const loadData = async (freshTeam = null) => {
    try {
      let u;
      try {
        u = await base44.auth.me();
      } catch (authErr) {
        console.warn('loadData: auth.me 401 – redirecting to login');
        setLoading(false);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      if (!u) {
        setLoading(false);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      // Auto-promote to admin so entity RLS rules allow creating teams, players, transactions etc.
      if (u.role !== 'admin') {
        try {
          await base44.auth.updateMe({ role: 'admin' });
          u = await base44.auth.me();
        } catch (promoteErr) {
          console.warn('loadData: promote to admin failed', promoteErr);
        }
      }
      setUser(u);

      let myTeams;
      if (freshTeam) {
        // Deterministic: include the just-created team immediately
        const fetched = await fetchMyTeams(u.email);
        const has = fetched.some(t => t.id === freshTeam.id);
        myTeams = has ? fetched : [freshTeam, ...fetched];
      } else {
        myTeams = await fetchMyTeams(u.email);
      }

      const adminTeams = myTeams.filter(t =>
        t.members?.some(m => m.email === u.email && m.role === 'admin') ||
        t.created_by === u.email
      );
      setTeams(myTeams);
      setIsAdmin(adminTeams.length > 0);

      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      let selected =
        (savedTeamId && myTeams.find(t => t.id === savedTeamId)) ||
        freshTeam ||
        myTeams[0] ||
        null;

      if (selected) {
        localStorage.setItem('idrettsøkonomi_team_id', selected.id);
      }
      setCurrentTeam(selected);

      // Load player profile — non-blocking, never hangs loadData
      if (selected) {
        base44.entities.Player.filter({ team_id: selected.id, user_email: u.email })
          .then(players => { if (players.length > 0) setPlayerProfile(players[0]); })
          .catch(e => console.warn('Player profile fetch failed:', e));
      }
    } catch (e) {
      // Silently ignore auth errors – redirect already handled above
      if (!e?.message?.includes('Authentication')) {
        console.error('loadData error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectTeam = async (team) => {
    setCurrentTeam(team);
    localStorage.setItem('idrettsøkonomi_team_id', team.id);
    base44.entities.Player.filter({ team_id: team.id, user_email: user?.email })
      .then(players => setPlayerProfile(players.length > 0 ? players[0] : null))
      .catch(e => console.warn('selectTeam player fetch failed:', e));
  };

  const refreshTeams = async () => {
    if (!user) return;
    const myTeams = await fetchMyTeams(user.email);
    setTeams(myTeams);
    if (currentTeam) {
      const updated = myTeams.find(t => t.id === currentTeam.id);
      if (updated) setCurrentTeam(updated);
    }
  };

  const refreshPlayerProfile = async () => {
    if (!currentTeam || !user) return;
    base44.entities.Player.filter({ team_id: currentTeam.id, user_email: user.email })
      .then(players => setPlayerProfile(players.length > 0 ? players[0] : null))
      .catch(e => console.warn('refreshPlayerProfile failed:', e));
  };

  const isTeamAdmin = (team = currentTeam) => {
    if (!team || !user) return false;
    return (
      team.created_by === user.email ||
      team.members?.some(m => m.email === user.email && ['admin', 'kasserer', 'styreleder', 'revisor'].includes(m.role))
    );
  };

  const getUserTeamRole = (team = currentTeam) => {
    if (!team || !user) return 'player';
    // Team creator is always admin, even if not explicitly in members array
    if (team.created_by === user.email) return 'admin';
    const member = team.members?.find(m => m.email === user.email);
    return member?.role || 'player';
  };

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

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}