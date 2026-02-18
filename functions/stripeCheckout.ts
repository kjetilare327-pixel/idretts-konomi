import Stripe from 'npm:stripe@14.21.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mode, price_id, custom_amount, team_id, team_name, success_url, cancel_url } = await req.json();

    // Validate inputs
    if (!mode || !team_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let lineItems;

    if (mode === 'donation' && custom_amount) {
      // Custom donation amount – create a price on-the-fly
      lineItems = [{
        price_data: {
          currency: 'nok',
          product_data: {
            name: `Donasjon til ${team_name || 'idrettslaget'}`,
            description: 'Takk for støtten!',
          },
          unit_amount: Math.round(custom_amount * 100), // øre
        },
        quantity: 1,
      }];
    } else if (price_id) {
      lineItems = [{ price: price_id, quantity: 1 }];
    } else {
      return Response.json({ error: 'Missing price_id or custom_amount' }, { status: 400 });
    }

    const sessionParams = {
      mode: mode === 'subscription' ? 'subscription' : 'payment',
      line_items: lineItems,
      customer_email: user.email,
      success_url: success_url || 'https://example.com/success',
      cancel_url: cancel_url || 'https://example.com/cancel',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        team_id,
        user_email: user.email,
        payment_type: mode,
      },
    };

    // Allow custom amounts for donations
    if (mode === 'donation') {
      sessionParams.payment_method_types = ['card'];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});