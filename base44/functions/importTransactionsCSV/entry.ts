import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, team_id } = await req.json();
    if (!file_url || !team_id) return Response.json({ error: 'file_url and team_id required' }, { status: 400 });

    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Krever admin eller kasserer' }, { status: 403 });
      }
    }

    // Fetch CSV file
    const response = await fetch(file_url);
    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return Response.json({ error: 'CSV file is empty or invalid' }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Expected columns: date, description, amount, type, category
    const requiredColumns = ['date', 'amount'];
    const hasRequired = requiredColumns.every(col => headers.includes(col));
    
    if (!hasRequired) {
      return Response.json({ 
        error: `CSV must contain at least: ${requiredColumns.join(', ')}`,
        found_columns: headers 
      }, { status: 400 });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });

        // Parse transaction data
        const amount = parseFloat(row.amount);
        if (isNaN(amount) || amount <= 0) {
          results.skipped++;
          continue;
        }

        const transactionData = {
          team_id,
          date: row.date || new Date().toISOString().split('T')[0],
          amount: Math.abs(amount),
          type: row.type?.toLowerCase() === 'income' ? 'income' : 'expense',
          category: row.category || 'Diverse',
          description: row.description || `Import ${new Date().toLocaleDateString('nb-NO')}`,
          status: 'active',
          reconciled: 'unreconciled'
        };

        // Create transaction
        await base44.asServiceRole.entities.Transaction.create(transactionData);
        results.imported++;

      } catch (error) {
        results.errors.push({
          line: i + 1,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      ...results,
      message: `Imported ${results.imported} transactions, skipped ${results.skipped}`
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});