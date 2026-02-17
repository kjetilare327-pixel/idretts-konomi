import React, { createContext, useContext, useMemo } from 'react';
import { useTeam } from '@/components/shared/TeamContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const { currentTeam, user } = useTeam();

  const { data: roleDefinitions = [] } = useQuery({
    queryKey: ['roleDefinitions', currentTeam?.id],
    queryFn: () => base44.entities.RoleDefinition.filter({ team_id: currentTeam?.id }),
    enabled: !!currentTeam?.id,
  });

  const userRole = useMemo(() => {
    if (!currentTeam || !user) return null;
    const member = currentTeam.members?.find(m => m.email === user.email);
    return member?.role;
  }, [currentTeam, user]);

  const userPermissions = useMemo(() => {
    if (!userRole || !roleDefinitions) return [];
    const role = roleDefinitions.find(r => r.role_name === userRole);
    return role?.permissions || [];
  }, [userRole, roleDefinitions]);

  const hasPermission = (permission) => {
    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(p => userPermissions.includes(p));
  };

  const hasAllPermissions = (permissions) => {
    return permissions.every(p => userPermissions.includes(p));
  };

  return (
    <RoleContext.Provider value={{
      userRole,
      userPermissions,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      roleDefinitions
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleAccess() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoleAccess must be used within RoleProvider');
  return ctx;
}

export function ProtectedComponent({ children, permission, fallback = null }) {
  const { hasPermission } = useRoleAccess();

  if (!hasPermission(permission)) {
    return fallback || (
      <div className="p-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Du har ikke tilgang til denne funksjonen.
        </p>
      </div>
    );
  }

  return children;
}