import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, team_id } = await req.json();
    if (!file_url || !team_id) {
      return Response.json({ error: 'file_url and team_id required' }, { status: 400 });
    }

    // Require admin or kasserer
    if (user.role !== 'admin') {
      const membership = await base44.asServiceRole.entities.TeamMember.filter({ team_id, user_email: user.email.toLowerCase() });
      const allowedRoles = ['admin', 'kasserer', 'styreleder'];
      if (!membership.length || !allowedRoles.includes(membership[0].role)) {
        return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
      }
    }

    // Use AI vision to extract receipt data
    const extractionPrompt = `Analyser denne kvitteringen/fakturaen og hentstøtende informasjon.

Returner data i følgende JSON-format:
{
  "amount": tall (totalt beløp i NOK),
  "date": "YYYY-MM-DD",
  "vendor": "leverandørnavn",
  "category": "kategori (f.eks. Utstyr, Mat, Transport, Diverse)",
  "description": "kort beskrivelse av kjøp",
  "items": [{"item": "varenavn", "price": tall}],
  "confidence": "high/medium/low"
}

Hvis du ikke finner et felt, sett det til null.`;

    const ocrResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: extractionPrompt,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          date: { type: 'string' },
          vendor: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          items: { type: 'array' },
          confidence: { type: 'string' }
        }
      }
    });

    // Validate and format the result
    const extractedData = {
      amount: ocrResult.amount || 0,
      date: ocrResult.date || new Date().toISOString().split('T')[0],
      vendor: ocrResult.vendor || 'Ukjent',
      category: ocrResult.category || 'Diverse',
      description: ocrResult.description || 'Kvittering',
      items: ocrResult.items || [],
      confidence: ocrResult.confidence || 'medium',
      attachment_url: file_url
    };

    return Response.json({
      success: true,
      extracted_data: extractedData,
      message: 'Receipt scanned successfully'
    });

  } catch (error) {
    console.error('OCR scanning error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});