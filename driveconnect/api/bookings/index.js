// api/bookings/index.js — Créer une réservation (POST) et lister (GET)
const supabase = require('../../lib/supabase');
const { requireAuth, setCors } = require('../../lib/auth');

const COMMISSION = 0.02;

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  // GET — mes réservations
  if (req.method === 'GET') {
    let query;
    if (decoded.userType === 'student') {
      query = supabase
        .from('bookings')
        .select(`
          id, slot_id, date, time, duration, amount, commission, net,
          status, payment_status, cancelled_by, refund_amount, cancelled_at, created_at,
          instructors!inner(id, users!inner(name))
        `)
        .eq('student_id', decoded.uid)
        .order('created_at', { ascending: false });
    } else {
      // Moniteur: récupérer son instructor_id
      const { data: instructor } = await supabase
        .from('instructors')
        .select('id')
        .eq('user_id', decoded.uid)
        .single();

      if (!instructor) return res.status(404).json({ error: 'Profil moniteur introuvable' });

      query = supabase
        .from('bookings')
        .select(`
          id, slot_id, date, time, duration, amount, commission, net,
          status, payment_status, cancelled_by, refund_amount, cancelled_at, created_at,
          users!student_id(name)
        `)
        .eq('instructor_id', instructor.id)
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erreur liste bookings:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Normaliser le format
    const normalized = data.map(b => ({
      id: b.id,
      slotId: b.slot_id,
      date: b.date,
      time: b.time,
      duration: b.duration,
      amount: b.amount,
      commission: b.commission,
      net: b.net,
      status: b.status,
      paymentStatus: b.payment_status,
      cancelledBy: b.cancelled_by,
      refundAmount: b.refund_amount,
      cancelledAt: b.cancelled_at,
      createdAt: b.created_at,
      instructorName: b.instructors?.users?.name,
      studentName: b.users?.name
    }));

    return res.status(200).json(normalized);
  }

  // POST — créer une réservation (élève uniquement)
  if (req.method === 'POST') {
    if (decoded.userType !== 'student') {
      return res.status(403).json({ error: 'Réservé aux élèves' });
    }

    const { slotId, paypalOrderId } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId requis' });

    // Vérifier le créneau (avec lock optimiste)
    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .select('id, instructor_id, date, time, duration, price, available')
      .eq('id', slotId)
      .eq('available', true)
      .single();

    if (slotErr || !slot) {
      return res.status(409).json({ error: 'Ce créneau n\'est plus disponible' });
    }

    // Vérifier que la date est dans le futur
    const slotDateTime = new Date(`${slot.date}T${slot.time}`);
    if (slotDateTime <= new Date()) {
      return res.status(400).json({ error: 'Ce créneau est passé' });
    }

    // Calculer commission
    const commission = Math.round(slot.price * COMMISSION);
    const net = slot.price - commission;

    // Transaction: marquer slot indisponible + créer réservation
    const { error: slotUpdateErr } = await supabase
      .from('slots')
      .update({ available: false })
      .eq('id', slotId)
      .eq('available', true); // Double vérification de disponibilité

    if (slotUpdateErr) {
      return res.status(409).json({ error: 'Ce créneau vient d\'être réservé par quelqu\'un d\'autre' });
    }

    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        slot_id: slotId,
        student_id: decoded.uid,
        instructor_id: slot.instructor_id,
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
        amount: slot.price,
        commission,
        net,
        status: 'confirmed',
        payment_status: 'paid',
        paypal_order_id: paypalOrderId || null
      })
      .select()
      .single();

    if (bookingErr) {
      // Rollback: remettre le slot disponible
      await supabase.from('slots').update({ available: true }).eq('id', slotId);
      console.error('Erreur création booking:', bookingErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Récupérer le nom du moniteur pour la réponse
    const { data: instructor } = await supabase
      .from('instructors')
      .select('users!inner(name)')
      .eq('id', slot.instructor_id)
      .single();

    return res.status(201).json({
      ...booking,
      instructorName: instructor?.users?.name
    });
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
