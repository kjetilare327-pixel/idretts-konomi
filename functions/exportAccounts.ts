import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { team_id, format_type, year } = await req.json();

    if (!team_id || !format_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [transactions, budgets, players, team] = await Promise.all([
      base44.entities.Transaction.filter({ team_id }),
      base44.entities.Budget.filter({ team_id }),
      base44.entities.Player.filter({ team_id }),
      base44.entities.Team.get(team_id)
    ]);

    const filterYear = year ? parseInt(year) : new Date().getFullYear();

    // Filter transactions by year
    const yearTransactions = transactions.filter(t => {
      const txYear = new Date(t.date).getFullYear();
      return txYear === filterYear;
    });

    // Calculate financial figures
    const totalIncome = yearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = yearTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netResult = totalIncome - totalExpenses;

    if (format_type === 'tripletex') {
      // Generate Tripletex-compatible JSON format
      const tripletexData = {
        company: {
          name: team.name,
          nif: team.nif_number || '',
          reportDate: new Date().toISOString().split('T')[0]
        },
        accountingPeriod: {
          year: filterYear,
          startDate: `${filterYear}-01-01`,
          endDate: `${filterYear}-12-31`
        },
        incomeStatement: {
          revenue: totalIncome,
          costs: totalExpenses,
          netResult: netResult
        },
        transactions: yearTransactions.map(t => ({
          date: t.date,
          description: t.description,
          account: t.type === 'income' ? '3000' : '4000',
          amount: t.amount,
          category: t.category,
          type: t.type
        }))
      };

      const csv = generateTripletexCSV(tripletexData);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="tripletex_export_${filterYear}.csv"`
        }
      });
    }

    if (format_type === 'fiken') {
      // Generate Fiken-compatible format
      const fikenData = generateFikenFormat({
        team,
        transactions: yearTransactions,
        year: filterYear,
        totalIncome,
        totalExpenses,
        netResult
      });

      const csv = fikenData;
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="fiken_export_${filterYear}.csv"`
        }
      });
    }

    // Standard accounting format
    const reportData = {
      team: team.name,
      year: filterYear,
      reportDate: new Date().toISOString().split('T')[0],
      incomeStatement: {
        revenue: totalIncome,
        operatingCosts: totalExpenses,
        netResult: netResult
      },
      balance: {
        assets: totalIncome,
        liabilities: totalExpenses
      }
    };

    return Response.json(reportData);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateTripletexCSV(data) {
  let csv = 'Bilagsdato;Bilagsnummer;Beskrivelse;Konto;Beløp;Kategori\n';
  
  data.transactions.forEach((tx, i) => {
    csv += `${tx.date};;${tx.description};${tx.account};${tx.amount};${tx.category}\n`;
  });

  csv += `\n\nResultatregnskap ${data.accountingPeriod.year}\n`;
  csv += `Inntekter;${data.incomeStatement.revenue}\n`;
  csv += `Kostnader;${data.incomeStatement.costs}\n`;
  csv += `Resultat;${data.incomeStatement.netResult}\n`;

  return csv;
}

function generateFikenFormat(data) {
  let csv = 'Dato;Beskrivelse;Beløp;Kategori;Type\n';
  
  data.transactions.forEach(tx => {
    csv += `${tx.date};${tx.description};${tx.amount};${tx.category};${tx.type}\n`;
  });

  csv += `\n\nSammendrag ${data.year}\n`;
  csv += `Total inntekt;${data.totalIncome}\n`;
  csv += `Total kostnad;${data.totalExpenses}\n`;
  csv += `Netto resultat;${data.netResult}\n`;

  return csv;
}