// api/instructors/me.js — Profil et position GPS du moniteur connecté
const supabase = require('../../lib/supabase');
const { requireAuth, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = requireAuth(req, res);
  if (!decoded) return;
  if (decoded.userType !== 'instructor') {
    return res.status(403).json({ error: 'Réservé aux moniteurs' });
  }

  const { data: instructor, error } = await supabase
    .from('instructors')
    .select('*')
    .eq('user_id', decoded.uid)
    .single();

  if (error || !instructor) return res.status(404).json({ error: 'Profil moniteur introuvable' });

  // GET — récupérer le profil
  if (req.method === 'GET') {
    return res.status(200).json(instructor);
  }

  // PUT — mettre à jour le profil
  if (req.method === 'PUT') {
    const { location, phoneNumber, hourlyRate, experience, isOnline, lat, lng } = req.body;

    const updates = {};
    if (location !== undefined)    updates.location = location;
    if (phoneNumber !== undefined)  updates.phone_number = phoneNumber;
    if (hourlyRate !== undefined)   updates.hourly_rate = parseInt(hourlyRate);
    if (experience !== undefined)   updates.experience = parseInt(experience);
    if (isOnline !== undefined)     updates.is_online = Boolean(isOnline);
    if (lat !== undefined)          updates.lat = parseFloat(lat);
    if (lng !== undefined)          updates.lng = parseFloat(lng);

    if (updates.hourly_rate && updates.hourly_rate < 1000) {
      return res.status(400).json({ error: 'Tarif minimum: 1000 XPF/h' });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('instructors')
      .update(updates)
      .eq('id', instructor.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Erreur update instructeur:', updateErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    return res.status(200).json(updated);
  }

  res.status(405).json({ error: 'Méthode non autorisée' });
};
