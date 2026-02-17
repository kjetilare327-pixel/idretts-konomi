import React, { useState, useMemo } from 'react';
import { useTeam } from '../components/shared/TeamContext';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign, Calendar, Sparkles, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatNOK } from '../components/shared/FormatUtils';

export default function AdvancedAnalytics() {
  const { currentTeam, isTeamAdmin } = useTeam();
  const [timeRange, setTimeRange] = useState('12m');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', currentTeam?.id],
    queryFn: () => base44.entities.Transaction.filter({ team_id: currentTeam.id, status: 'active' }),
    enabled: !!currentTeam,
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', currentTeam?.id],
    queryFn: () => base44.entities.Budget.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: volunteerTasks = [] } = useQuery({
    queryKey: ['volunteer-tasks', currentTeam?.id],
    queryFn: () => base44.entities.VolunteerTask.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', currentTeam?.id],
    queryFn: () => base44.entities.Event.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims', currentTeam?.id],
    queryFn: () => base44.entities.Claim.filter({ team_id: currentTeam.id }),
    enabled: !!currentTeam,
  });

  // Calculate time range
  const getMonthsBack = () => {
    switch(timeRange) {
      case '3m': return 3;
      case '6m': return 6;
      case '12m': return 12;
      case '24m': return 24;
      default: return 12;
    }
  };

  const monthsBack = getMonthsBack();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);

  // Filter transactions by date range
  const filteredTransactions = transactions.filter(t => 
    new Date(t.date) >= startDate
  );

  // Monthly trend analysis
  const monthlyTrends = useMemo(() => {
    const months = {};
    
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { 
        month: date.toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' }),
        income: 0, 
        expense: 0, 
        net: 0,
        budget_income: 0,
        budget_expense: 0
      };
    }

    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        if (t.type === 'income') {
          months[key].income += t.amount;
        } else {
          months[key].expense += t.amount;
        }
      }
    });

    // Add budget data
    budgets.forEach(b => {
      Object.keys(months).forEach(key => {
        if (b.type === 'income') {
          months[key].budget_income += b.monthly_amount;
        } else {
          months[key].budget_expense += b.monthly_amount;
        }
      });
    });

    Object.keys(months).forEach(key => {
      months[key].net = months[key].income - months[key].expense;
      months[key].budget_net = months[key].budget_income - months[key].budget_expense;
    });

    return Object.values(months);
  }, [filteredTransactions, budgets, monthsBack]);

  // Category analysis
  const categoryAnalysis = useMemo(() => {
    const categories = {};
    
    filteredTransactions.forEach(t => {
      if (!categories[t.category]) {
        categories[t.category] = { name: t.category, amount: 0, type: t.type, count: 0 };
      }
      categories[t.category].amount += t.amount;
      categories[t.category].count += 1;
    });

    return Object.values(categories).sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  // Event ROI analysis
  const eventROI = useMemo(() => {
    const economicEvents = events.filter(e => e.type === 'tournament' || e.type === 'social');
    
    return economicEvents.map(event => {
      const eventClaims = claims.filter(c => c.description?.includes(event.title));
      const revenue = eventClaims.reduce((sum, c) => sum + (c.status === 'paid' ? c.amount : 0), 0);
      const eventExpenses = filteredTransactions.filter(t => 
        t.description?.toLowerCase().includes(event.title.toLowerCase()) && t.type === 'expense'
      );
      const cost = eventExpenses.reduce((sum, t) => sum + t.amount, 0);
      const roi = cost > 0 ? ((revenue - cost) / cost * 100) : 0;

      return {
        name: event.title,
        revenue,
        cost,
        profit: revenue - cost,
        roi,
        date: event.date
      };
    }).filter(e => e.cost > 0 || e.revenue > 0).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  }, [events, claims, filteredTransactions]);

  // Volunteer task value
  const volunteerValue = useMemo(() => {
    const completed = volunteerTasks.filter(t => t.status === 'completed');
    const totalHours = completed.reduce((sum, t) => sum + (t.hours_estimated || 0), 0);
    const hourlyValue = 200; // NOK per hour estimate
    
    return {
      totalTasks: completed.length,
      totalHours,
      estimatedValue: totalHours * hourlyValue,
      avgTaskValue: completed.length > 0 ? (totalHours * hourlyValue) / completed.length : 0
    };
  }, [volunteerTasks]);

  // Predictive alerts
  const predictiveAlerts = useMemo(() => {
    const alerts = [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentMonthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const currentIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const currentExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const budgetIncome = budgets.filter(b => b.type === 'income').reduce((sum, b) => sum + b.monthly_amount, 0);
    const budgetExpense = budgets.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.monthly_amount, 0);

    // Budget overspending alert
    if (currentExpense > budgetExpense * 0.9) {
      alerts.push({
        type: 'warning',
        severity: currentExpense > budgetExpense ? 'high' : 'medium',
        title: 'Budsjettoverskridelse',
        message: `Utgifter denne måneden (${formatNOK(currentExpense)}) nærmer seg eller overstiger budsjett (${formatNOK(budgetExpense)})`,
        category: 'budget'
      });
    }

    // Underincome alert
    if (currentIncome < budgetIncome * 0.7) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        title: 'Lav inntjening',
        message: `Inntekter denne måneden (${formatNOK(currentIncome)}) er lavere enn forventet (${formatNOK(budgetIncome)})`,
        category: 'income'
      });
    }

    // Unpaid claims alert
    const unpaidClaims = claims.filter(c => c.status === 'pending' || c.status === 'overdue');
    const unpaidAmount = unpaidClaims.reduce((sum, c) => sum + c.amount, 0);
    
    if (unpaidClaims.length > 0) {
      alerts.push({
        type: 'info',
        severity: unpaidClaims.length > 10 ? 'high' : 'low',
        title: 'Ubetalte krav',
        message: `${unpaidClaims.length} ubetalte krav til verdi av ${formatNOK(unpaidAmount)}`,
        category: 'claims'
      });
    }

    return alerts;
  }, [transactions, budgets, claims]);

  const fetchAIInsights = async () => {
    setAnalysisLoading(true);
    try {
      const response = await base44.functions.invoke('analyzeFinancials', { team_id: currentTeam.id });
      setAiInsights(response.data);
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (!currentTeam || !isTeamAdmin()) {
    return <div className="p-6">Du må være administrator for å se avanserte analyser</div>;
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Avanserte finansielle analyser</h1>
          <p className="text-slate-600 dark:text-slate-400">Dypdykk i økonomiske trender og prediktive innsikter</p>
        </div>
        <div className="flex gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 måneder</SelectItem>
              <SelectItem value="6m">6 måneder</SelectItem>
              <SelectItem value="12m">12 måneder</SelectItem>
              <SelectItem value="24m">24 måneder</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAIInsights} disabled={analysisLoading} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Sparkles className="w-4 h-4" />
            {analysisLoading ? 'Analyserer...' : 'AI-analyse'}
          </Button>
        </div>
      </div>

      {/* Predictive alerts */}
      {predictiveAlerts.length > 0 && (
        <div className="grid gap-3">
          {predictiveAlerts.map((alert, idx) => (
            <Card key={idx} className={`border-l-4 ${
              alert.severity === 'high' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' :
              alert.severity === 'medium' ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20' :
              'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                    alert.severity === 'high' ? 'text-red-600' :
                    alert.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                  }`} />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{alert.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{alert.message}</p>
                  </div>
                  <Badge variant="outline">{alert.category}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Insights */}
      {aiInsights && (
        <Card className="border-2 border-purple-200 dark:border-purple-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-drevne innsikter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiInsights.insights?.map((insight, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                <h4 className="font-medium mb-1">{insight.title}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">{insight.description}</p>
                {insight.recommendation && (
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                    💡 {insight.recommendation}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="trends">Trender</TabsTrigger>
          <TabsTrigger value="categories">Kategorier</TabsTrigger>
          <TabsTrigger value="roi">Avkastning</TabsTrigger>
          <TabsTrigger value="volunteer">Dugnadsverdier</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          {/* Income vs Expense trend */}
          <Card>
            <CardHeader>
              <CardTitle>Inntekter vs. Utgifter over tid</CardTitle>
              <CardDescription>Sammenligning av faktiske tall mot budsjett</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNOK(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" name="Inntekter" strokeWidth={2} />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Utgifter" strokeWidth={2} />
                  <Line type="monotone" dataKey="budget_income" stroke="#10b981" strokeDasharray="5 5" name="Budsjett inntekt" />
                  <Line type="monotone" dataKey="budget_expense" stroke="#ef4444" strokeDasharray="5 5" name="Budsjett utgift" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Net profit trend */}
          <Card>
            <CardHeader>
              <CardTitle>Netto resultat over tid</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNOK(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="net" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Netto" />
                  <Area type="monotone" dataKey="budget_net" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeDasharray="5 5" name="Budsjett netto" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Utgifter per kategori</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryAnalysis.filter(c => c.type === 'expense')}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${formatNOK(entry.amount)}`}
                    >
                      {categoryAnalysis.filter(c => c.type === 'expense').map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatNOK(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inntekter per kategori</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryAnalysis.filter(c => c.type === 'income')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatNOK(value)} />
                    <Bar dataKey="amount" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Avkastning på arrangementer</CardTitle>
              <CardDescription>Inntekter vs. utgifter for økonomirelaterte arrangementer</CardDescription>
            </CardHeader>
            <CardContent>
              {eventROI.length > 0 ? (
                <div className="space-y-3">
                  {eventROI.map((event, idx) => (
                    <div key={idx} className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{event.name}</h3>
                          <p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString('nb-NO')}</p>
                        </div>
                        <Badge className={event.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {event.profit >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                          ROI: {event.roi.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Inntekt</p>
                          <p className="font-semibold text-emerald-600">{formatNOK(event.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Kostnad</p>
                          <p className="font-semibold text-red-600">{formatNOK(event.cost)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Profitt</p>
                          <p className={`font-semibold ${event.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatNOK(event.profit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500">Ingen arrangementsdata tilgjengelig</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volunteer" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-950">
                    <Activity className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Fullførte dugnader</p>
                    <p className="text-2xl font-bold">{volunteerValue.totalTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-950">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Totale timer</p>
                    <p className="text-2xl font-bold">{volunteerValue.totalHours}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Estimert verdi</p>
                    <p className="text-2xl font-bold">{formatNOK(volunteerValue.estimatedValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-950">
                    <Target className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Snitt per dugnad</p>
                    <p className="text-2xl font-bold">{formatNOK(volunteerValue.avgTaskValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dugnad verdiskaping</CardTitle>
              <CardDescription>Estimert økonomisk verdi av frivillig arbeid (200 kr/time)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <div className="flex items-center gap-4">
                  <TrendingUp className="w-12 h-12 text-purple-600" />
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      Gjennom {volunteerValue.totalTasks} fullførte dugnader har laget spart
                    </p>
                    <p className="text-4xl font-bold text-purple-600">{formatNOK(volunteerValue.estimatedValue)}</p>
                    <p className="text-sm text-slate-500 mt-1">Basert på {volunteerValue.totalHours} timer frivillig arbeid</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}