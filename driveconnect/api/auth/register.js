// api/auth/register.js
const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { signToken, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { email, password, name, userType } = req.body;

  // Validation
  if (!email || !password || !name || !userType) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }
  if (!['student', 'instructor'].includes(userType)) {
    return res.status(400).json({ error: 'Type utilisateur invalide' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  // Vérifier si email déjà utilisé
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  // Hasher le mot de passe (12 rounds = sécurisé)
  const passwordHash = await bcrypt.hash(password, 12);

  // Créer l'utilisateur
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name.trim(),
      user_type: userType
    })
    .select('id, email, name, user_type, created_at')
    .single();

  if (userError) {
    console.error('Erreur création user:', userError);
    return res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }

  // Si moniteur, créer le profil instructeur
  if (userType === 'instructor') {
    const { error: instrError } = await supabase
      .from('instructors')
      .insert({
        user_id: user.id,
        location: 'Nouméa',
        hourly_rate: 4500,
        verified: false,
        is_online: false,
        lat: -22.2758,
        lng: 166.4580
      });

    if (instrError) {
      console.error('Erreur création instructeur:', instrError);
      // Rollback: supprimer l'utilisateur
      await supabase.from('users').delete().eq('id', user.id);
      return res.status(500).json({ error: 'Erreur lors de la création du profil moniteur' });
    }
  }

  // Générer le token JWT
  const token = signToken({
    uid: user.id,
    email: user.email,
    name: user.name,
    userType: user.user_type
  });

  res.status(201).json({
    token,
    user: {
      uid: user.id,
      email: user.email,
      name: user.name,
      userType: user.user_type
    }
  });
};
