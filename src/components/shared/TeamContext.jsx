import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const TeamContext = createContext(null);

// Roles that have access to financial/admin features
export const FINANCE_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];
export const ADMIN_ROLES = ['admin'];

async function fetchMyTeams(userEmail) {
  const [createdTeams, allTeams] = await Promise.all([
    base44.entities.Team.filter({ created_by: userEmail }).catch(() => []),
    base44.entities.Team.list().catch(() => []),
  ]);
  const byId = new Map();
  for (const t of [...createdTeams, ...allTeams]) {
    const isMine =
      t.created_by === userEmail ||
      t.members?.some(m => m.email === userEmail);
    if (isMine) byId.set(t.id, t);
  }
  return [...byId.values()];
}

// Compute the initial team state synchronously from bootData so that
// the very first render already has correct values — no useEffect gap.
function computeInitialState(bootData) {
  if (!bootData) {
    return { currentTeam: null, teams: [], myMemberships: {}, currentTeamRole: 'player', loading: true, user: null };
  }
  const userEmail = bootData.user?.email;
  const myTeams = bootData.teams || [];
  const map = {};
  if (bootData.memberTeams) {
    for (const m of bootData.memberTeams) map[m.team_id] = m;
  }
  const savedTeamId = typeof localStorage !== 'undefined' ? localStorage.getItem('idrettsøkonomi_team_id') : null;
  const selected = (savedTeamId && myTeams.find(t => t.id === savedTeamId)) || myTeams[0] || null;
  let role = 'player';
  if (selected) {
    const membership = map[selected.id];
    if (membership) role = membership.role;
    else if (selected.created_by === userEmail) role = 'admin';
    else {
      const leg = selected.members?.find(m => m.email === userEmail);
      role = leg?.role || 'player';
    }
    try { localStorage.setItem('idrettsøkonomi_team_id', selected.id); } catch(_) {}
  }
  console.log('[TeamProvider] initial state from bootData — team=', selected?.name, 'role=', role);
  return { currentTeam: selected, teams: myTeams, myMemberships: map, currentTeamRole: role, loading: false, user: bootData.user };
}

export function TeamProvider({ children, bootData }) {
  const init = computeInitialState(bootData);
  const [currentTeam, setCurrentTeam] = useState(init.currentTeam);
  const [teams, setTeams] = useState(init.teams);
  const [loading, setLoading] = useState(init.loading);
  const [user, setUser] = useState(init.user);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [myMemberships, setMyMemberships] = useState(init.myMemberships);
  const [currentTeamRole, setCurrentTeamRole] = useState(init.currentTeamRole);

  const loadMemberships = useCallback(async (userEmail, teamList) => {
    if (!userEmail || !teamList.length) return {};
    const memberships = await base44.entities.TeamMember.filter({ user_email: userEmail }).catch(() => []);
    const map = {};
    for (const m of memberships) map[m.team_id] = m;

    // Backfill: if user created a team but has no TeamMember entry, create one
    for (const team of teamList) {
      if (team.created_by === userEmail && !map[team.id]) {
        const created = await base44.entities.TeamMember.create({
          team_id: team.id,
          user_email: userEmail,
          role: 'admin',
          status: 'active',
        }).catch(() => null);
        if (created) map[team.id] = created;
      }
    }
    return map;
  }, []);

  const resolveRole = useCallback((teamId, membershipsMap, userEmail, teamObj) => {
    const membership = membershipsMap[teamId];
    if (membership) return membership.role;
    // Legacy fallback: check Team.members array
    if (teamObj?.created_by === userEmail) return 'admin';
    const legacyMember = teamObj?.members?.find(m => m.email === userEmail);
    return legacyMember?.role || 'player';
  }, []);

  const loadData = useCallback(async (freshTeam = null) => {
    console.log('[TeamContext] loadData start');
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
      setUser(u);

      let myTeams;
      if (freshTeam) {
        const fetched = await fetchMyTeams(u.email);
        const has = fetched.some(t => t.id === freshTeam.id);
        myTeams = has ? fetched : [freshTeam, ...fetched];
      } else {
        myTeams = await fetchMyTeams(u.email);
      }

      setTeams(myTeams);

      const membershipsMap = await loadMemberships(u.email, myTeams);
      setMyMemberships(membershipsMap);

      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      const selected =
        (savedTeamId && myTeams.find(t => t.id === savedTeamId)) ||
        freshTeam ||
        myTeams[0] ||
        null;

      if (selected) {
        console.log('[TeamContext] team selected:', selected.name);
        localStorage.setItem('idrettsøkonomi_team_id', selected.id);
        const role = resolveRole(selected.id, membershipsMap, u.email, selected);
        setCurrentTeamRole(role);
        setCurrentTeam(selected);
        base44.entities.Player.filter({ team_id: selected.id, user_email: u.email })
          .then(players => { if (players.length > 0) setPlayerProfile(players[0]); })
          .catch(() => {});
      } else {
        setCurrentTeam(null);
        setCurrentTeamRole('player');
        // No teams found – redirect to Onboarding
        if (!window.location.pathname.includes('Onboarding') && !window.location.search.includes('Onboarding')) {
          const params = new URLSearchParams(window.location.search);
          if (!['Onboarding', 'GdprConsent'].includes(params.get('page'))) {
            window.location.replace(window.location.origin + '?page=Onboarding');
          }
        }
      }
    } catch (e) {
      if (!e?.message?.includes('Authentication')) {
        console.error('[TeamContext] loadData error:', e);
      }
    } finally {
      console.log('[TeamContext] loadData done');
      setLoading(false);
    }
  }, [loadMemberships, resolveRole]);

  useEffect(() => {
    if (bootData) {
      // AuthGate already verified the user has teams — use prefetched data
      console.log('[TeamContext] using bootData, teams=', bootData.teams?.length);
      const userEmail = bootData.user?.email;
      const myTeams = bootData.teams || [];
      setTeams(myTeams);
      // Build memberships map from prefetched member records
      const map = {};
      if (bootData.memberTeams) {
        for (const m of bootData.memberTeams) map[m.team_id] = m;
      }
      setMyMemberships(map);
      const savedTeamId = localStorage.getItem('idrettsøkonomi_team_id');
      const selected = (savedTeamId && myTeams.find(t => t.id === savedTeamId)) || myTeams[0] || null;
      if (selected) {
        localStorage.setItem('idrettsøkonomi_team_id', selected.id);
        const role = resolveRole(selected.id, map, userEmail, selected);
        setCurrentTeamRole(role);
        setCurrentTeam(selected);
        base44.entities.Player.filter({ team_id: selected.id, user_email: userEmail })
          .then(players => { if (players.length > 0) setPlayerProfile(players[0]); })
          .catch(() => {});
      }
      setLoading(false);
    } else {
      loadData();
    }
  }, []);

  const selectTeam = async (team) => {
    setCurrentTeam(team);
    localStorage.setItem('idrettsøkonomi_team_id', team.id);
    const role = resolveRole(team.id, myMemberships, user?.email, team);
    setCurrentTeamRole(role);
    base44.entities.Player.filter({ team_id: team.id, user_email: user?.email })
      .then(players => setPlayerProfile(players.length > 0 ? players[0] : null))
      .catch(() => {});
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

  const refreshTeamMembers = async () => {
    if (!user || !teams.length) return;
    const membershipsMap = await loadMemberships(user.email, teams);
    setMyMemberships(membershipsMap);
    if (currentTeam) {
      const role = resolveRole(currentTeam.id, membershipsMap, user.email, currentTeam);
      setCurrentTeamRole(role);
    }
  };

  const refreshPlayerProfile = async () => {
    if (!currentTeam || !user) return;
    base44.entities.Player.filter({ team_id: currentTeam.id, user_email: user.email })
      .then(players => setPlayerProfile(players.length > 0 ? players[0] : null))
      .catch(() => {});
  };

  // Legacy helpers for backward compatibility
  const isTeamAdmin = (team = currentTeam) => {
    if (!team || !user) return false;
    const role = resolveRole(team.id, myMemberships, user.email, team);
    return FINANCE_ROLES.includes(role);
  };

  const getUserTeamRole = (team = currentTeam) => {
    if (!team || !user) return 'player';
    return resolveRole(team.id, myMemberships, user.email, team);
  };

  const canViewFinance = (team = currentTeam) => {
    return FINANCE_ROLES.includes(getUserTeamRole(team));
  };

  const isAdmin = teams.some(t => resolveRole(t.id, myMemberships, user?.email, t) === 'admin');

  return (
    <TeamContext.Provider value={{
      currentTeam,
      teams,
      loading,
      user,
      playerProfile,
      isAdmin,
      currentTeamRole,
      myMemberships,
      selectTeam,
      refreshTeams,
      refreshTeamMembers,
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