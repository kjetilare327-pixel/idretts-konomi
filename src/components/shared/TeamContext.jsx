import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const TeamContext = createContext(null);

export const FINANCE_ROLES = ['admin', 'kasserer', 'styreleder', 'revisor'];
export const MEMBER_ROLES = ['player', 'forelder']; // non-finance member roles
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

// Synchronously compute initial state from bootData so first render is correct
const ROLE_PRIORITY = ['admin', 'kasserer', 'styreleder', 'revisor', 'forelder', 'player'];

function buildMembershipMap(memberTeams) {
  const map = {};
  for (const m of (memberTeams || [])) {
    if (m.status !== 'active') continue;
    const existing = map[m.team_id];
    if (!existing || ROLE_PRIORITY.indexOf(m.role) < ROLE_PRIORITY.indexOf(existing.role)) {
      map[m.team_id] = m;
    }
  }
  return map;
}

function computeInitialState(bootData) {
  if (!bootData) {
    return { currentTeam: null, teams: [], myMemberships: {}, currentTeamRole: 'player', loading: true, user: null };
  }
  const userEmail = (bootData.user?.email || '').toLowerCase();
  const myTeams = bootData.teams || [];
  const map = buildMembershipMap(bootData.memberTeams || []);
  const savedTeamId = typeof localStorage !== 'undefined' ? localStorage.getItem('idrettsøkonomi_team_id') : null;
  const selected = (savedTeamId && myTeams.find(t => t.id === savedTeamId)) || myTeams[0] || null;
  let role = 'player';
  if (selected) {
    const membership = map[selected.id];
    if (membership) {
      role = membership.role;
    } else if ((selected.created_by || '').toLowerCase() === userEmail) {
      role = 'admin';
    } else {
      const leg = selected.members?.find(m => (m.email || '').toLowerCase() === userEmail);
      role = leg?.role || 'player';
    }
    try { localStorage.setItem('idrettsøkonomi_team_id', selected.id); } catch(_) {}
  }
  console.log(`[TeamContext] computeInitialState: user=${userEmail} team=${selected?.id} role=${role} memberTeams=${(bootData.memberTeams||[]).length}`);
  return { currentTeam: selected, teams: myTeams, myMemberships: map, currentTeamRole: role, loading: false, user: bootData.user };
}

export function TeamProvider({ children, bootData }) {
  const init = computeInitialState(bootData);
  const [currentTeam, setCurrentTeam]       = useState(init.currentTeam);
  const [teams, setTeams]                   = useState(init.teams);
  const [loading, setLoading]               = useState(init.loading);
  const [user, setUser]                     = useState(init.user);
  const [playerProfile, setPlayerProfile]   = useState(null);
  const [myMemberships, setMyMemberships]   = useState(init.myMemberships);
  const [currentTeamRole, setCurrentTeamRole] = useState(init.currentTeamRole);

  const loadMemberships = useCallback(async (userEmail, teamList) => {
    if (!userEmail || !teamList.length) return {};
    const lowerEmail = userEmail.toLowerCase();
    const memberships = await base44.entities.TeamMember.filter({ user_email: lowerEmail }).catch(() => []);
    const PRIORITY = ['admin', 'kasserer', 'styreleder', 'revisor', 'forelder', 'player'];
    const map = {};
    for (const m of memberships) {
      // Only consider active memberships; keep highest-privilege per team
      if (m.status !== 'active') continue;
      const existing = map[m.team_id];
      if (!existing || PRIORITY.indexOf(m.role) < PRIORITY.indexOf(existing.role)) {
        map[m.team_id] = m;
      }
    }

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
    const lowerEmail = (userEmail || '').toLowerCase();
    const membership = membershipsMap[teamId];
    if (membership) return membership.role;
    if (teamObj?.created_by === userEmail || teamObj?.created_by === lowerEmail) return 'admin';
    const legacyMember = teamObj?.members?.find(m => (m.email || '').toLowerCase() === lowerEmail);
    return legacyMember?.role || 'player';
  }, []);

  const loadData = useCallback(async (freshTeam = null) => {
    try {
      let u;
      try {
        u = await base44.auth.me();
      } catch (authErr) {
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
      }
    } catch (e) {
      if (!e?.message?.includes('Authentication')) {
        console.error('[TeamContext] loadData error:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [loadMemberships, resolveRole]);

  useEffect(() => {
    if (bootData) {
      const userEmail = bootData.user?.email;
      const myTeams = bootData.teams || [];
      const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('idrettsøkonomi_team_id') : null;
      const sel = (savedId && myTeams.find(t => t.id === savedId)) || myTeams[0] || null;
      // Apply role from bootData immediately (already set synchronously via computeInitialState)
      if (sel && userEmail) {
        base44.entities.Player.filter({ team_id: sel.id, user_email: userEmail })
          .then(players => { if (players.length > 0) setPlayerProfile(players[0]); })
          .catch(() => {});
      }
      // Async refresh to pick up any DB changes since boot
      if (userEmail && myTeams.length) {
        loadMemberships(userEmail, myTeams).then(freshMap => {
          setMyMemberships(freshMap);
          if (sel) {
            const freshRole = resolveRole(sel.id, freshMap, userEmail, sel);
            console.log(`[TeamContext] refreshed role: team=${sel.id} user=${userEmail} role=${freshRole}`);
            setCurrentTeamRole(freshRole);
          }
        }).catch(() => {});
      }
    } else {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  if (!ctx) {
    // Safe stub — prevents hard crash if a component is rendered outside the provider in an edge case
    console.error('[useTeam] Called outside TeamProvider');
    return {
      currentTeam: null, teams: [], loading: true, user: null,
      playerProfile: null, isAdmin: false, currentTeamRole: 'player',
      myMemberships: {}, selectTeam: () => {}, refreshTeams: () => {},
      refreshTeamMembers: () => {}, refreshPlayerProfile: () => {},
      loadData: () => {}, isTeamAdmin: () => false,
      getUserTeamRole: () => 'player', canViewFinance: () => false,
    };
  }
  return ctx;
}