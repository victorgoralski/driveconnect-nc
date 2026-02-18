// api/instructors/index.js - Liste des moniteurs avec leurs créneaux
const supabase = require('../../lib/supabase');
const { setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { data: instructors, error } = await supabase
    .from('instructors')
    .select(`
      id,
      user_id,
      rating,
      total_reviews,
      experience,
      location,
      hourly_rate,
      phone_number,
      verified,
      is_online,
      lat,
      lng,
      penalty_until,
      visibility_penalty,
      users!inner(id, name, email)
    `)
    .eq('verified', true)
    .order('rating', { ascending: false });

  if (error) {
    console.error('Erreur liste instructeurs:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }

  // Calculer le score pour le tri (avec pénalité)
  const now = new Date();
  const scored = instructors.map(i => {
    const hasPenalty = i.penalty_until && new Date(i.penalty_until) > now;
    const score = i.rating * 100 - (hasPenalty ? i.visibility_penalty : 0);
    return {
      id: i.id,
      uid: i.user_id,
      name: i.users.name,
      email: i.users.email,
      rating: parseFloat(i.rating),
      totalReviews: i.total_reviews,
      experience: i.experience,
      location: i.location,
      hourlyRate: i.hourly_rate,
      phoneNumber: i.phone_number,
      verified: i.verified,
      isOnline: i.is_online,
      lat: parseFloat(i.lat),
      lng: parseFloat(i.lng),
      penaltyUntil: i.penalty_until,
      visibilityPenalty: i.visibility_penalty,
      _score: score
    };
  }).sort((a, b) => b._score - a._score);

  res.status(200).json(scored);
};
