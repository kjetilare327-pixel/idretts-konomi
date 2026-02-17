import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team_id } = await req.json();
    
    if (!team_id) {
      return Response.json({ error: 'team_id is required' }, { status: 400 });
    }

    // Fetch all data that may contain PII
    const [players, auditLogs, claims, transactions, team] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id }),
      base44.asServiceRole.entities.AuditLog.filter({ team_id }),
      base44.asServiceRole.entities.Claim.filter({ team_id }),
      base44.asServiceRole.entities.Transaction.filter({ team_id }),
      base44.asServiceRole.entities.Team.get(team_id)
    ]);

    // Analyze data for GDPR compliance
    const now = new Date();
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Count PII instances
    const piiData = {
      total_players: players.length,
      active_players: players.filter(p => p.status === 'active').length,
      archived_players: players.filter(p => p.status === 'archived').length,
      players_with_phone: players.filter(p => p.phone).length,
      players_with_notes: players.filter(p => p.notes).length,
      old_audit_logs: auditLogs.filter(l => new Date(l.created_date) < threeYearsAgo).length,
      old_inactive_players: players.filter(p => 
        p.status === 'archived' && 
        new Date(p.updated_date) < oneYearAgo
      ).length,
      total_audit_logs: auditLogs.length,
    };

    // Build context for AI analysis
    const context = `
GDPR COMPLIANCE ANALYSIS FOR: ${team.name}

DATA OVERVIEW:
- Total spillere: ${piiData.total_players} (${piiData.active_players} aktive, ${piiData.archived_players} arkiverte)
- Spillere med telefonnummer: ${piiData.players_with_phone}
- Spillere med notater: ${piiData.players_with_notes}
- Totalt revisjonslogger: ${piiData.total_audit_logs}
- Revisjonslogger eldre enn 3 år: ${piiData.old_audit_logs}
- Inaktive spillere eldre enn 1 år: ${piiData.old_inactive_players}

GDPR KRAV (Norge/EU):
- Personopplysninger må kun lagres så lenge det er nødvendig
- Rett til sletting (GDPR Art. 17)
- Anonymisering av data når formålet er oppfylt
- Revisjon og logging må være proporsjonalt
- Data minimization principle

ANALYSER:
1. Identifiser ALLE potensielle GDPR-risker i datasettet
2. Foreslå konkrete tiltak for hver risiko (anonymisering, sletting, arkivering)
3. Prioriter tiltakene (kritisk, viktig, anbefalt)
4. Generer en GDPR compliance rapport med status og anbefalinger
`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: context,
      response_json_schema: {
        type: 'object',
        properties: {
          compliance_score: {
            type: 'number',
            description: 'Score 0-100, hvor 100 er fullt compliant'
          },
          risk_level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Overall risk level'
          },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                description: { type: 'string' },
                affected_records: { type: 'number' },
                legal_reference: { type: 'string' },
                recommendation: { type: 'string' }
              }
            }
          },
          suggested_actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action_type: { 
                  type: 'string',
                  enum: ['delete', 'anonymize', 'archive', 'review', 'update_policy']
                },
                target: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                estimated_records: { type: 'number' },
                deadline: { type: 'string' }
              }
            }
          },
          anonymization_strategies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                data_type: { type: 'string' },
                current_state: { type: 'string' },
                proposed_anonymization: { type: 'string' },
                impact: { type: 'string' }
              }
            }
          },
          compliance_summary: { type: 'string' },
          next_review_date: { type: 'string' }
        }
      }
    });

    return Response.json({
      success: true,
      analysis: aiResponse,
      data_overview: piiData,
      analyzed_at: now.toISOString()
    });

  } catch (error) {
    console.error('Error analyzing GDPR compliance:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});