// api/slots/index.js - Créneaux d'un moniteur (GET) et création (POST)
const supabase = require('../../lib/supabase');
const { requireAuth, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/slots?instructorId=xxx — liste créneaux disponibles d'un moniteur
  if (req.method === 'GET') {
    const { instructorId } = req.query;
    if (!instructorId) {
      return res.status(400).json({ error: 'instructorId requis' });
    }

    const today = new Date().toISOString().split('T')[0];
    const { data: slots, error } = await supabase
      .from('slots')
      .select('id, instructor_id, date, time, duration, price, available')
      .eq('instructor_id', instructorId)
      .eq('available', true)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) return res.status(500).json({ error: 'Erreur serveur' });
    return res.status(200).json(slots);
  }

  // POST /api/slots — créer un créneau (moniteur authentifié)
  if (req.method === 'POST') {
    const decoded = requireAuth(req, res);
    if (!decoded) return;
    if (decoded.userType !== 'instructor') {
      return res.status(403).json({ error: 'Réservé aux moniteurs' });
    }

    const { date, time, duration, price } = req.body;
    if (!date || !time || !duration || !price) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    if (price < 1000) {
      return res.status(400).json({ error: 'Tarif minimum: 1000 XPF' });
    }
    if (new Date(date) < new Date(new Date().toISOString().split('T')[0])) {
      return res.status(400).json({ error: 'La date doit être dans le futur' });
    }

    // Récupérer l'instructor_id depuis le user_id
    const { data: instructor, error: iErr } = await supabase
      .from('instructors')
      .select('id')
      .eq('user_id', decoded.uid)
      .single();

    if (iErr || !instructor) {
      return res.status(404).json({ error: 'Profil moniteur introuvable' });
    }

    // Vérifier si créneau déjà existant
    const { data: existing } = await supabase
      .from('slots')
      .select('id')
      .eq('instructor_id', instructor.id)
      .eq('date', date)
      .eq('time', time)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Vous avez déjà un créneau à cette heure' });
    }

    const { data: slot, error: slotErr } = await supabase
      .from('slots')
      .insert({
        instructor_id: instructor.id,
        date,
        time,
        duration: parseFloat(duration),
        price: Math.round(parseFloat(price) * parseFloat(duration)),
        available: true
      })
      .select()
      .single();

    if (slotErr) {
      console.error('Erreur création slot:', slotErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    return res.status(201).json(slot);
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
