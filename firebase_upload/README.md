# 📤 Instructions d'Upload Firebase

## Dossier créé : `firebase_upload/`

Ce dossier contient tous les fichiers prêts à uploader sur Firebase Storage.

---

## 📋 Structure des fichiers

```
firebase_upload/
├── version.json              ← À uploader à la RACINE de Firebase
└── data/
    ├── tasks_1.0.0.json     ← À uploader dans le dossier data/
    └── hideout_1.0.0.json   ← À uploader dans le dossier data/
```

---

## 🚀 Instructions d'Upload

### Étape 1 : Uploader les fichiers de données

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet **TarkovTracker**
3. Cliquez sur **Storage** dans le menu gauche
4. Cliquez sur le dossier **`data`**
5. Cliquez sur **"⬆️ Importer un fichier"** (bouton bleu en haut)
6. Sélectionnez **`firebase_upload/data/tasks_1.0.0.json`**
7. Uploadez
8. Répétez pour **`firebase_upload/data/hideout_1.0.0.json`**

✅ Les fichiers sont maintenant dans `data/` sur Firebase

### Étape 2 : Uploader version.json

1. Dans Firebase Storage, cliquez sur le nom du bucket en haut pour revenir à la **racine** :
   `gs://tarkovtracker-6abe2.firebasestorage.app`
2. Vous devriez voir juste le dossier **`data/`**
3. Cliquez sur **"⬆️ Importer un fichier"**
4. Sélectionnez **`firebase_upload/version.json`**
5. Uploadez

✅ Firebase est maintenant configuré !

---

## ✅ Vérification

Votre Firebase Storage devrait maintenant ressembler à :

```
gs://tarkovtracker-6abe2.firebasestorage.app/
├── version.json                    ← Nouveau
└── data/
    ├── tasks_1.0.0.json           ← Nouveau
    └── hideout_1.0.0.json         ← Nouveau
```

---

## 🔑 Prochaine Étape

Après avoir uploadé ces fichiers, il faut :
1. Récupérer vos credentials Firebase (Project Settings)
2. Les ajouter dans `src/services/firebaseConfig.js`
3. Rebuild l'app : `npm run build`
4. Lancer : `npx cross-env NODE_ENV=production electron .`

Et vous verrez l'auto-update fonctionner ! 🎉
