# Instructions pour Publier sur GitHub

## Problème Actuel

Le push vers GitHub est bloqué car un token GitHub a été détecté dans l'historique Git (même s'il a été retiré du fichier actuel).

## Solution Recommandée

### Étape 1: Révoquer le Token Exposé

1. Allez sur GitHub: https://github.com/settings/tokens
2. Trouvez et révoquez le token `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`
3. Créez un nouveau token avec les permissions:
   - `repo` (accès complet au dépôt)
   - `write:packages` (pour publier les releases)

### Étape 2: Nettoyer l'Historique Git (Option A - Recommandée)

Utilisez l'option `--push-option` pour bypasser la protection GitHub en confirmant que vous allez révoquer le token:

```powershell
git push origin main --push-option=bypassPushProtection
```

### Alternative (Option B): Réécrire l'Historique

Si l'option A ne fonctionne pas, vous pouvez réécrire l'historique pour retirer complètement le token:

```powershell
# ATTENTION: Ceci modifie l'historique Git!
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch publish.ps1" --prune-empty --tag-name-filter cat -- --all

# Puis forcer le push
git push origin main --force
```

### Étape 3: Utiliser GitHub Actions

Une fois le code pushé, créez un tag pour déclencher le build:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

Cela déclenchera automatiquement le workflow GitHub Actions qui buildera et publiera l'application.

## Alternative Complète: Utiliser Uniquement GitHub Actions

Vous n'avez plus besoin du fichier `publish.ps1` ni d'un token local. GitHub Actions utilisera automatiquement `GITHUB_TOKEN` (fourni par GitHub) pour publier les releases.

Le workflow s'exécutera sur les serveurs de GitHub (Windows) et n'aura pas les problèmes locaux avec 7za.
