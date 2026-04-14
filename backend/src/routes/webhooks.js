import { Router } from 'express';

const router = Router();

// POST /webhooks/pb — receive PB webhook events
router.post('/pb', async (req, res) => {
  const event = req.body;
  console.log('Received PB webhook event:', JSON.stringify(event, null, 2));

  // TODO: Match event to deployed scripts and trigger relevant ones
  // For now, acknowledge receipt
  res.json({ received: true, eventType: event.type || 'unknown' });
});

export default router;
