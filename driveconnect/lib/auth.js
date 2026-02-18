// lib/auth.js - Middleware JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

/**
 * Génère un token JWT pour un utilisateur
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Vérifie et décode un token JWT
 * Retourne { user } si valide, ou lance une erreur
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Middleware Express-style pour protéger les routes API
 * Utilisation: const user = requireAuth(req, res); if (!user) return;
 */
function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant ou invalide' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    return verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    } else {
      res.status(401).json({ error: 'Token invalide' });
    }
    return null;
  }
}

/**
 * Headers CORS communs à toutes les routes API
 */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

module.exports = { signToken, verifyToken, requireAuth, setCors };
