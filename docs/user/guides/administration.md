---
title: Administration
description: Valider les comptes et gérer la plateforme (administrateurs et modérateurs).
sidebar:
  order: 3
---

Les administrateurs de la plateforme sont les adresses e-mail listées par l'hébergeur dans la
configuration (`PLATFORM_ADMIN_EMAILS`). À la première connexion, leur compte est créé et validé
automatiquement. Les **modérateurs** sont nommés par un administrateur dans l'application (voir
[Nommer des modérateurs](#nommer-des-modérateurs)). Un lien **Administration** apparaît en bas de la colonne de gauche sur un
ordinateur, en haut de la page sur un téléphone. La liste est lue au démarrage de l'application : un ajout ou un retrait
prend effet après son redémarrage.

## La file d'attente

**Administration** a cinq onglets : **Demandes**, **Comptes**, **Collectifs**, **Modérateurs**
(administrateurs seulement) et **Catégories**.
**Demandes** (`/admin`) rassemble toutes les demandes en attente : comptes, collectifs et
responsables, avec leur nombre en haut de la page. Chaque nouvelle demande vous est aussi signalée
par e-mail, avec un lien vers cette page, aux administrateurs comme aux modérateurs ; l'accueil en
affiche aussi le nombre.

**Collectifs** liste les collectifs validés, avec leur ville, leur nombre de responsables et
d'objets ; un nom mène à l'onglet **Responsables** du collectif.

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

Sur la page d'un collectif, onglet **Responsables**, la section **Gérer les responsables** (visible
des administrateurs)
permet de **Retirer** un responsable, par exemple quand il quitte l'association. Un collectif garde
toujours au moins un responsable : pour retirer le dernier, indiquez dans le même formulaire l'e-mail
d'un utilisateur validé qui le remplace. La personne retirée est prévenue par e-mail.

## Désactiver un compte

L'onglet **Comptes** d'**Administration** liste les comptes actifs. **Désactiver** coupe immédiatement
l'accès de la personne : elle est déconnectée partout et ne peut plus recevoir de lien de connexion.
Rien n'est supprimé, et son matériel reste visible. Vous ne pouvez pas désactiver votre propre compte,
ni celui d'un autre administrateur de la plateforme (marqué « administrateur ») : pour retirer ses
droits, l'hébergeur le retire de `PLATFORM_ADMIN_EMAILS`. Un modérateur ne peut pas non plus
désactiver ni réactiver le compte d'un autre modérateur (marqué « modérateur »).

## Réactiver un compte

La section **Comptes désactivés** de l'onglet **Comptes** liste les comptes désactivés.
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

## Nommer des modérateurs

Les modérateurs partagent le travail des administrateurs. Ils traitent les demandes (comptes,
collectifs, responsables), désactivent ou réactivent des comptes, gèrent les catégories et retirent
du matériel abusif. Comme les administrateurs, ils voient le matériel de tous les collectifs, mais
pas l'adresse exacte des lieux. Ils ne peuvent agir ni sur un administrateur ni sur un autre
modérateur, et ne nomment personne.

**Administration**, onglet **Modérateurs** (administrateurs seulement) :

- **Nommer modérateur** : indiquez l'adresse e-mail d'un compte validé. La personne garde son
  matériel et ses collectifs ; le lien **Administration** apparaît à sa prochaine page.
- **Retirer** : la personne redevient un utilisateur ordinaire, aussitôt.

Chaque nomination et chaque retrait sont inscrits au journal.

## Retirer du matériel abusif

Sur la page d'un objet, un modérateur trouve **Retirer (modération)** ; un administrateur choisit
**Archiver** puis la raison **Retiré par la modération**. Écrivez au propriétaire pourquoi le
matériel est retiré : ce message lui est envoyé par e-mail (aux responsables du collectif s'il
appartient à un collectif) et n'est pas conservé. L'objet est archivé, pas supprimé : sa page et son
historique restent visibles de ceux qui le gèrent.
