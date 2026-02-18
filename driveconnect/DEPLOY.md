# 🚀 Guide de déploiement — DriveConnect NC
### Vercel + Supabase + JWT | Temps estimé: 30-45 minutes

---

## 📋 PRÉREQUIS

- Un compte **GitHub** (gratuit) → https://github.com
- Un compte **Supabase** (gratuit) → https://supabase.com
- Un compte **Vercel** (gratuit) → https://vercel.com
- **Node.js 18+** installé sur votre machine → https://nodejs.org
- **Vercel CLI** : `npm install -g vercel`

---

## ÉTAPE 1 — Préparer Supabase (base de données)

### 1.1 Créer un projet Supabase
1. Allez sur https://supabase.com → **New project**
2. Choisissez un nom: `driveconnect-nc`
3. Choisissez un mot de passe fort pour la DB (notez-le)
4. Région: choisissez la plus proche (ex: **Singapore** pour la NC)
5. Cliquez **Create new project** → attendez ~2 minutes

### 1.2 Récupérer les clés API
Dans votre projet Supabase → **Settings** (engrenage) → **API** :
- Copiez **Project URL** → `SUPABASE_URL`
- Copiez **service_role (secret)** → `SUPABASE_SERVICE_KEY`
  ⚠️ NE JAMAIS exposer cette clé côté client !

### 1.3 Exécuter la migration SQL
1. Dans Supabase → **SQL Editor** → **New query**
2. Copiez tout le contenu du fichier `lib/migration.sql`
3. Cliquez **Run** (▶)
4. Vérifiez que vous voyez: `users: 3, instructors: 3, slots: 126`

✅ **Base de données prête !**

---

## ÉTAPE 2 — Générer le secret JWT

Ouvrez un terminal et exécutez:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copiez la sortie (longue chaîne hexadécimale) → `JWT_SECRET`

---

## ÉTAPE 3 — Préparer le projet en local

```bash
# Cloner / se placer dans le dossier du projet
cd driveconnect-nc

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env.local
```

Éditez `.env.local` et remplissez les 3 valeurs:
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=votre_secret_généré_à_l_étape_2
```

### Tester en local
```bash
vercel dev
# → Ouvrir http://localhost:3000
```

---

## ÉTAPE 4 — Déployer sur GitHub

```bash
# Initialiser Git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit - DriveConnect NC"

# Créer un repo sur GitHub (https://github.com/new)
# Puis connecter:
git remote add origin https://github.com/VOTRE_USERNAME/driveconnect-nc.git
git push -u origin main
```

---

## ÉTAPE 5 — Déployer sur Vercel

### 5.1 Via la CLI
```bash
# Dans le dossier du projet
vercel

# Répondre aux questions:
# ? Set up and deploy "driveconnect-nc"? → Y
# ? Which scope? → votre compte
# ? Link to existing project? → N
# ? Project name? → driveconnect-nc
# ? In which directory is your code? → ./
# ? Want to modify settings? → N
```

### 5.2 Configurer les variables d'environnement sur Vercel
```bash
# Ajouter les secrets (ils seront chiffrés sur Vercel)
vercel env add SUPABASE_URL
# → collez votre URL Supabase, Enter

vercel env add SUPABASE_SERVICE_KEY
# → collez votre service key, Enter

vercel env add JWT_SECRET
# → collez votre secret JWT, Enter
```

### 5.3 Redéployer avec les variables
```bash
vercel --prod
```

✅ **Votre app est en ligne !** Vercel vous donnera une URL du type:
`https://driveconnect-nc.vercel.app`

---

## ÉTAPE 6 — Vérification finale

### Tester l'API
```bash
# Health check
curl https://votre-app.vercel.app/api/instructors

# Créer un compte test
curl -X POST https://votre-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234","name":"Test User","userType":"student"}'
```

### Comptes démo déjà créés (mot de passe: `demo1234`)
- sophie@demo.com → Moniteur
- thomas@demo.com → Moniteur
- marie@demo.com → Moniteur

---

## ÉTAPE 7 — Nom de domaine personnalisé (optionnel)

Si vous avez un domaine (ex: `driveconnect.nc`) :
1. Vercel → votre projet → **Settings** → **Domains**
2. Ajoutez votre domaine
3. Suivez les instructions DNS

---

## 🔒 SÉCURITÉ — Ce qui est en place

| Mesure | Détail |
|--------|--------|
| Mots de passe | Hachés avec bcrypt (12 rounds) |
| Authentification | JWT signé HS256, expire en 7 jours |
| Secrets | Variables d'environnement chiffrées Vercel |
| CORS | Headers configurés sur chaque endpoint |
| Validation | Vérification des inputs côté serveur |
| Anti timing-attack | Délai simulé si email inconnu |
| RLS Supabase | Row Level Security activé sur toutes les tables |
| HTTPS | Automatique via Vercel |

---

## 🔧 COMMANDES UTILES

```bash
# Voir les logs en temps réel
vercel logs https://votre-app.vercel.app --follow

# Redéployer
git push origin main  # Vercel redéploie automatiquement

# Accéder à la DB
# → Supabase Dashboard → Table Editor
```

---

## ❓ DÉPANNAGE

**"supabase is not defined"**
→ Vérifiez que les variables d'environnement sont bien configurées sur Vercel

**"relation users does not exist"**
→ La migration SQL n'a pas été exécutée. Retournez à l'Étape 1.3

**CORS error dans le navigateur**
→ Vérifiez que votre domaine est bien le même que l'origine de l'API

**Token expiré**
→ Normal après 7 jours, l'utilisateur doit se reconnecter

---

*DriveConnect NC — Plateforme de cours de conduite à Nouméa*
