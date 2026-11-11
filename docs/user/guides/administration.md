---
title: Administration
description: Valider les comptes et gérer la plateforme (administrateurs).
sidebar:
  order: 3
---

Les administrateurs de la plateforme sont les adresses e-mail listées par l'hébergeur dans la
configuration (`PLATFORM_ADMIN_EMAILS`). À la première connexion, leur compte est créé et validé
automatiquement. Un lien **Administration** apparaît en bas de la colonne de gauche sur un
ordinateur, en haut de la page sur un téléphone. La liste est lue au démarrage de l'application : un ajout ou un retrait
prend effet après son redémarrage.

## La file d'attente

**Administration** (`/admin`) rassemble toutes les demandes en attente : comptes, collectifs et
responsables, avec leur nombre en haut de la page. Chaque nouvelle demande vous est aussi signalée
par e-mail, avec un lien vers cette page.

## Valider les comptes

Dans la section « Comptes à valider » :

- **Accepter** ouvre le compte ; la personne reçoit un e-mail l'invitant à se connecter.
- **Refuser** ferme la demande ; vous pouvez indiquer un motif, qui est envoyé à la personne et
  affiché sur sa page « Votre compte ». Elle pourra refaire une demande plus tard.

Chaque décision est enregistrée dans l'historique de la plateforme (qui a décidé, quand), sans le
motif ni aucune donnée personnelle.

## Valider les collectifs

Les demandes de collectif apparaissent dans **Administration**, avec le nom de la personne qui les a
faites. Vérifiez que le collectif n'existe pas déjà sous un autre nom et que la personne en fait
bien partie.

- **Accepter** inscrit le collectif ; la personne qui l'a demandé en devient **responsable**.
- **Refuser** libère le nom ; le motif éventuel est envoyé par e-mail à la personne.

## Valider les responsables

Quand une personne demande à **devenir responsable** d'un collectif existant, la demande apparaît
dans **Administration**, section « Responsables à valider ». Vérifiez auprès des responsables
actuels si besoin, puis **Accepter** ou **Refuser** ; la personne est prévenue par e-mail.

## Retirer un responsable

Sur la page d'un collectif, la section **Gérer les responsables** (visible des administrateurs)
permet de **Retirer** un responsable, par exemple quand il quitte l'association. Un collectif garde
toujours au moins un responsable : pour retirer le dernier, indiquez dans le même formulaire l'e-mail
d'un utilisateur validé qui le remplace. La personne retirée est prévenue par e-mail.

## Désactiver un compte

La page **Administration** liste aussi les comptes actifs. **Désactiver** coupe immédiatement
l'accès de la personne : elle est déconnectée partout et ne peut plus recevoir de lien de connexion.
Rien n'est supprimé, et son matériel reste visible. Vous ne pouvez pas désactiver votre propre compte,
ni celui d'un autre administrateur de la plateforme (marqué « administrateur ») : pour retirer ses
droits, l'hébergeur le retire de `PLATFORM_ADMIN_EMAILS`.

## Réactiver un compte

La section **Comptes désactivés** de la page **Administration** liste les comptes désactivés.
**Réactiver** rend à la personne ses accès : elle peut de nouveau demander un lien de connexion.
La réactivation est enregistrée dans l'historique de la plateforme.

## Gérer les catégories

**Administration**, onglet **Catégories**, liste les catégories dans l'ordre où elles apparaissent
dans le formulaire d'ajout et dans les filtres de recherche. Chaque changement s'y voit aussitôt.

- **Ajouter** une catégorie : son nom en français. Elle s'ajoute en fin de liste. Deux catégories ne
  peuvent pas porter le même nom (majuscules et accents ne comptent pas).
- **Renommer** : le matériel garde sa catégorie, seul le nom affiché change.
- **Monter** ou **Descendre** change sa place dans la liste.
- **Supprimer…** : une catégorie que personne n'utilise disparaît aussitôt. Si du matériel l'utilise
  encore (y compris du matériel archivé), choisissez d'abord la catégorie qui le reçoit ; son
  historique indique le changement.

Chaque changement est inscrit au journal, sans le nom de la catégorie.
