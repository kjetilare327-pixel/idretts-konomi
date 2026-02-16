import { base44 } from '@/api/base44Client';

export async function logAudit({ teamId, action, entityType, entityId, oldValue, newValue, description }) {
  try {
    const user = await base44.auth.me();
    await base44.entities.AuditLog.create({
      team_id: teamId,
      user_email: user.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      description,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}