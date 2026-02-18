// api/slots/[id].js — Supprimer un créneau
const supabase = require('../../lib/supabase');
const { requireAuth, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée' });

  const decoded = requireAuth(req, res);
  if (!decoded) return;
  if (decoded.userType !== 'instructor') {
    return res.status(403).json({ error: 'Réservé aux moniteurs' });
  }

  const { id } = req.query;

  // Vérifier que le créneau appartient bien à ce moniteur
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('user_id', decoded.uid)
    .single();

  if (!instructor) return res.status(404).json({ error: 'Profil moniteur introuvable' });

  const { data: slot } = await supabase
    .from('slots')
    .select('id, instructor_id')
    .eq('id', id)
    .single();

  if (!slot) return res.status(404).json({ error: 'Créneau introuvable' });
  if (slot.instructor_id !== instructor.id) {
    return res.status(403).json({ error: 'Ce créneau ne vous appartient pas' });
  }

  // Vérifier qu'il n'y a pas de réservation active
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('slot_id', id)
    .not('status', 'eq', 'cancelled')
    .single();

  if (booking) {
    return res.status(409).json({ error: 'Impossible de supprimer un créneau réservé' });
  }

  const { error } = await supabase.from('slots').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Erreur serveur' });

  res.status(200).json({ success: true });
};
