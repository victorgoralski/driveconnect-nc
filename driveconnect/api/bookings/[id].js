// api/bookings/[id].js — Annuler, confirmer, rejeter une réservation
const supabase = require('../../lib/supabase');
const { requireAuth, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Méthode non autorisée' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  const { id } = req.query;
  const { action } = req.body; // 'cancel', 'confirm', 'reject'

  // Récupérer la réservation
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !booking) return res.status(404).json({ error: 'Réservation introuvable' });

  // Vérifier les autorisations
  const isStudent = decoded.userType === 'student' && booking.student_id === decoded.uid;

  let isInstructor = false;
  if (decoded.userType === 'instructor') {
    const { data: instr } = await supabase
      .from('instructors')
      .select('id')
      .eq('user_id', decoded.uid)
      .single();
    isInstructor = instr && booking.instructor_id === instr.id;
  }

  if (!isStudent && !isInstructor) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  if (booking.status === 'cancelled') {
    return res.status(409).json({ error: 'Cette réservation est déjà annulée' });
  }

  // --- ACTION: ANNULATION ---
  if (action === 'cancel') {
    const slotDateTime = new Date(`${booking.date}T${booking.time}`);
    const diffH = (slotDateTime - new Date()) / 3600000;

    let refundPct, refundLabel;
    if (diffH >= 48) { refundPct = 100; refundLabel = '100% remboursé'; }
    else if (diffH >= 24) { refundPct = 50; refundLabel = '50% remboursé'; }
    else { refundPct = 0; refundLabel = 'Aucun remboursement'; }

    // Si le moniteur annule, remboursement intégral
    if (isInstructor) { refundPct = 100; refundLabel = '100% remboursé (annulation moniteur)'; }

    const refundAmount = Math.round(booking.amount * refundPct / 100);

    const updates = {
      status: 'cancelled',
      cancelled_by: isStudent ? 'student' : 'instructor',
      refund_amount: refundAmount,
      cancelled_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id);

    if (updateErr) return res.status(500).json({ error: 'Erreur serveur' });

    // Remettre le créneau disponible si remboursement >= 50%
    if (refundPct >= 50) {
      await supabase.from('slots').update({ available: true }).eq('id', booking.slot_id);
    }

    // Si moniteur annule < 24h: appliquer pénalité de visibilité
    if (isInstructor && diffH < 24) {
      const { data: instr } = await supabase
        .from('instructors')
        .select('id')
        .eq('user_id', decoded.uid)
        .single();

      if (instr) {
        const penaltyEnd = new Date();
        penaltyEnd.setDate(penaltyEnd.getDate() + 7);
        await supabase
          .from('instructors')
          .update({ penalty_until: penaltyEnd.toISOString(), visibility_penalty: 10 })
          .eq('id', instr.id);
      }
    }

    return res.status(200).json({
      success: true,
      refundAmount,
      refundLabel,
      penaltyApplied: isInstructor && diffH < 24
    });
  }

  // --- ACTION: CONFIRMER (moniteur) ---
  if (action === 'confirm') {
    if (!isInstructor) return res.status(403).json({ error: 'Réservé aux moniteurs' });
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
    return res.status(200).json({ success: true });
  }

  // --- ACTION: REJETER (moniteur) ---
  if (action === 'reject') {
    if (!isInstructor) return res.status(403).json({ error: 'Réservé aux moniteurs' });
    await supabase.from('bookings').update({ status: 'rejected' }).eq('id', id);
    await supabase.from('slots').update({ available: true }).eq('id', booking.slot_id);
    return res.status(200).json({ success: true });
  }

  res.status(400).json({ error: 'Action invalide. Actions possibles: cancel, confirm, reject' });
};
