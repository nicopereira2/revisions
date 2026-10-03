# Révisions — mise en ligne

## 1. Base de données (Supabase, gratuit)
1. Crée un projet sur https://supabase.com.
2. **SQL Editor** → colle `supabase-setup.sql` → **Run**.
3. **Authentication → URL Configuration** → *Site URL* = l'adresse de ton appli (ex. `https://tonpseudo.github.io/revisions/`). Ajoute-la aussi dans *Redirect URLs*.
4. **Authentication → Emails → Templates** : dans **Confirm signup** ET **Magic Link**, ajoute la ligne `Ton code : {{ .Token }}` (c'est le code à 6 chiffres que l'appli demande). Enregistre les deux.
5. **Project Settings → API** → copie *Project URL* et la clé *anon public*.
6. Colle-les dans `config.js` (recommandé : tous tes appareils sont configurés d'office). Sinon, saisis-les dans l'écran « Configuration » de l'appli.

## 2. Hébergement (GitHub Pages, gratuit)
1. Nouveau dépôt → *Add file → Upload files* → tout le dossier.
2. *Settings → Pages* → Deploy from branch → `main` / root.
3. Sur iPhone : ouvre l'adresse dans Safari → Partager → « Sur l'écran d'accueil ».

## Ce qui est stocké où
- **Compte** : Supabase Auth, connexion par code à 6 chiffres envoyé par e-mail (aucun mot de passe stocké).
- **E-mails** : l'envoi intégré de Supabase est limité (quelques e-mails par heure, et seulement vers l'adresse de ton compte Supabase). Pour toi seul, c'est suffisant ; pour inviter des amis, branche un SMTP gratuit (ex. Resend) dans Authentication → Emails → SMTP.
- **Données** (cours, questions, progression, planning, historique) : table `user_data`, une ligne par compte, protégée par Row Level Security (`auth.uid() = user_id`).
- **Cache hors ligne** : localStorage de l'appareil, renvoyé automatiquement au retour du réseau.
- **Clé API Claude** : uniquement sur l'appareil, jamais envoyée en base.
