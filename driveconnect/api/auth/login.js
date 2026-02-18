// api/auth/login.js
const bcrypt = require('bcryptjs');
const supabase = require('../../lib/supabase');
const { signToken, setCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { email, password, userType } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  // Trouver l'utilisateur
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, user_type, password_hash')
    .eq('email', email.toLowerCase())
    .single();

  // Même message d'erreur si email inexistant ou mot de passe incorrect (sécurité)
  const GENERIC_ERROR = 'Email ou mot de passe incorrect';

  if (error || !user) {
    // Simuler le temps de hash pour éviter les attaques timing
    await bcrypt.hash('dummy', 12);
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  // Vérifier le type d'utilisateur si précisé
  if (userType && user.user_type !== userType) {
    await bcrypt.hash('dummy', 12);
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  // Vérifier le mot de passe
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ error: GENERIC_ERROR });
  }

  // Générer le token JWT
  const token = signToken({
    uid: user.id,
    email: user.email,
    name: user.name,
    userType: user.user_type
  });

  res.status(200).json({
    token,
    user: {
      uid: user.id,
      email: user.email,
      name: user.name,
      userType: user.user_type
    }
  });
};
