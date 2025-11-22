# Guide de Sécurité - TarkovTracker

## ✅ Status de Sécurité Actuel

### Token GitHub - SÉCURISÉ ✅
- **Status** : Alerte fermée
- **Actions prises** :
  - ✅ Token révoqué manuellement
  - ✅ Code nettoyé (`publish.ps1` ne contient plus le token)
  - ✅ Historique Git réécrit (`git reset --soft HEAD~2`)
  - ✅ Alerte GitHub marquée comme "Revoked" et fermée
  - ✅ GitHub Actions utilise maintenant `GITHUB_TOKEN` automatique

### Google API Key - ACTION REQUISE ⚠️
- **Status** : Alerte active
- **Localisation** : Probablement dans `firebase_upload/` ou configuration Firebase
- **Action nécessaire** : Voir section ci-dessous

---

## 🔐 Actions Recommandées pour la Google API Key

### Option 1 : Vérifier si la clé est sensible

**1. Allez sur la console Google Cloud** :
```
https://console.cloud.google.com/apis/credentials
```

**2. Trouvez la clé détectée et vérifiez** :
- Est-elle liée à des services critiques (base de données, authentification) ?
- Est-elle liée à des services publics (Firebase Hosting, etc.) ?

**3. Si la clé est sensible (base de données, storage privé)** :
- ⚠️ **Révoquez-la immédiatement**
- Créez une nouvelle clé
- Suivez l'Option 2 ci-dessous

**4. Si la clé est publique (Firebase Web Config)** :
- ✅ C'est normal qu'elle soit visible (clés web Firebase publiques)
- Fermez simplement l'alerte GitHub comme "Not used in production" ou "False positive"

### Option 2 : Sécuriser la clé avec GitHub Secrets

**1. Créez un secret GitHub** :
```
Settings > Secrets and variables > Actions > New repository secret
```

**2. Ajoutez la clé** :
- Nom : `GOOGLE_API_KEY`
- Valeur : Votre nouvelle clé API

**3. Modifiez votre code** :
- Retirez la clé du code
- Utilisez `process.env.GOOGLE_API_KEY` dans votre application
- Dans GitHub Actions, injectez la clé comme variable d'environnement

**4. Exemple dans workflow** :
```yaml
env:
  GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

### Option 3 : Fermer l'alerte si non critique

Si cette clé **n'est PAS sensible** (ex: Firebase Web Config publique) :

**1. Allez sur** :
```
https://github.com/crapucorp/trackov/security/secret-scanning
```

**2. Cliquez sur l'alerte Google API Key**

**3. Sélectionnez "Close as"** :
- Option : "Used in tests" ou "False positive"
- Confirmation : "Close alert"

---

## 📋 Checklist de Sécurité Actuelle

- [x] Token GitHub révoqué
- [x] Code nettoyé (publish.ps1)
- [x] Historique Git réécrit
- [x] Alerte GitHub fermée
- [x] GitHub Actions utilise GITHUB_TOKEN sécurisé
- [ ] **Google API Key vérifiée et sécurisée/fermée**

---

## 🚀 Pour les Futures Releases

### Comment Publier en Toute Sécurité

**Vous n'avez PLUS besoin de `publish.ps1` !**

Pour publier une nouvelle version :

```powershell
# 1. Modifier la version dans package.json
"version": "1.0.2"

# 2. Commit
git add .
git commit -m "chore: bump version to 1.0.2"

# 3. Push sur main
git push origin main

# 4. Créer et push le tag
git tag v1.0.2
git push origin v1.0.2
```

**GitHub Actions fera tout automatiquement** :
- Build de l'application
- Création de la release
- Upload des fichiers
- Génération de `latest.yml` pour auto-updates

**Aucun token personnel requis !**

---

## ⚙️ Configuration Actuelle Sécurisée

### GitHub Actions Workflow
**Fichier** : `.github/workflows/build-release.yml`

**Sécurité** :
- ✅ Utilise `GITHUB_TOKEN` automatique (fourni par GitHub)
- ✅ Permissions explicites : `contents: write`
- ✅ Pas de code signing (CSC_IDENTITY_AUTO_DISCOVERY: false)
- ✅ Pas de secrets hardcodés

**Ce workflow est 100% sécurisé** - Il ne nécessite aucun secret manuel.

---

## 📞 Aide Supplémentaire

Si vous avez des questions sur la sécurité ou besoin d'aide pour sécuriser la Google API Key, demandez-moi !

**Lien vers les alertes de sécurité** :
https://github.com/crapucorp/trackov/security/secret-scanning
