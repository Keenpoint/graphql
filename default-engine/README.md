# Documentation de l'engine

https://www.lucidchart.com/documents/edit/4e121e03-e68f-46bd-b624-b18c43b375e7/0

Cette documentation se base sur engine v1. Des brouillons d'architecture sont disponibles pour les v2 & v3.
Pour mémoire, les normes & processi à partir de v2 sont fusionnées.

## Principe

L'engine fait passer un élément à travers une norme, qui le valide, le fait évoluer et exécute des fonctions basées sur ses valeurs.
Cet élément peut être de n'importe quel type, mais on utilisera typiquement la norme pour faire évoluer des objets/tableaux, et leurs objets/tableaux liés. 

La norme est un flux d'évolution/validation. Chaque action de ce flux, nommée processus, est exécutée à la suite de la précédente.
Si une action est éxécutée sur des éléments d'une liste d'objets, elle s'exécutera sur toute la liste avant de déclencher la suivante.

## Utilisation

Exemple :
```
const dd = require("./[...]/default-engine/engine");


const horseNorm = {fields: [
    {path: "name", default: "Pocoto"}
]};

const horses = [
    {name: "Poupoune"},
    {}
];

dd.normalize(horses, horseNorm);


console.log(horses);
// [
//     {name: "Poupoune"},
//     {name: "Pocoto"}
// ];
```

### Arguments

`dd.normalize(object, norm, [options], [callback]);`

- `object`: Objet ou tableau à normaliser.
- `norm`: Norme appliquée.
- `options`: Options utilisées lors de la normalisation.
- `callback`: fonction de callback asynchrone. Rend l'exécution de la normalisation asynchrone si elle est présente, et autorise la présence de processi asynchrones.
- `return` : L'objet mis à jour. Uniquement si l'appel est synchrone.

## Normes

### Champs de la norme
 
Aucun champ n'est obligatoire :
- `default`: Valeur par défaut de l'objet normalisé.
Cette valeur est donnée uniquement si cet objet est `undefined`. Celle-ci est clonée (`_.clone`) avant d'être écrite.
- `$default`: Fonction synchrone renvoyant la valeur par défaut de l'objet normalisé. Cette fonction est exécutée uniquement si cet objet est `undefined`.
Ses arguments sont les mêmes que ceux des processi, à la différence qu'ils commencent par le parent, l'enfant étant obligatoirement `undefined`. Son `this` est identique.
Uniquement synchrone, pour créer la valeur par défaut de façon assynchrone, utiliser un processus de type $$u. On peut également fournir une string qui contient le chemin de la valeur qu'on veut prendre (voir chapitre résolution des chemins de défault).
- `name`: Nom donné à la norme. Utilisé dans les logs, les messages d'erreur, etc...
- `$if`: Fonction utilisée pour déterminer si l'on doit exécuter la norme en question. Uniquement synchrone.
Ses arguments et son `this` sont les mêmes que ceux des processi.
- `flags`: Flags de la norme. Non utilisés pour l'instant.
- `fields`: Tableau des normes enfant.
- `path`: Obligatoire dans les normes enfants. Chemin vers les enfants normalisés par cette norme. Voir "Résolution des chemins".
- `$p`: Processi de la norme. Peut être un tableau, ou un unique processus.Selon moi, il est plutot que une fonciton qui s'execute avec le argument de l'etape avant.
- `options`: Les options par défaut de la norme.

### Résolution des chemins de path

Les chemins sont résolus en ignorant les tableaux. Ainsi, `"horses.rider.name"` fonctionne de la même manière si `"horses"` est un tableau ou un objet.

Si le dernier élément est un tableau, c'est le tableau qui est utilisé, *pas ses éléments*.
Ex. : `{path: "horses" $p: ["string"]}` vérifiera que la valeur du champ horses est une string, et fera donc une erreur si celle-ci est un tableau.

### Résolution des chemins de default

On peut définir la valeur par défaut d'un champ comme celle d'un autre champ de l'object. 
Pour cela on définit chemin `$default` comme les chemins de path, mais avec également l'option de revenir en arrière dans l'arbre avec `"../"`

```
const horseNorm = {fields: [
    {path: "name", default: "Pocoto"},
    {path: "rider", fields: [
        {path: "horseName", $default: "../name"}
    ]}
]};

const horse = {name: "Poupoune", rider: {}};

dd.normalize(horse, horseNorm});

console.log(horse);
{
    name: "Poupoune",
    rider: {horseName: "Poupoune"} 
}

```

## Processi

### Champs des processi

Aucun champ n'est obligatoire :
- `type`: Le nom d'un processus déjà chargé, à aller chercher.
Le processus est apposé au processus de la norme, en convention sur configuration :`_.defaults(normProcess, processNamed)`.
- `$v`: Fonction de validation. La normalisation s'arrête si celle-ci `throw` une erreur, ou si elle renvoie une instance d'`Error`.
- `$u`: Fonction de mise à jour de la valeur. Si le processus s'exécute sur le champ d'un objet et que `$u` revoie `undefined`, le champ est supprimé/non-rempli plutôt que d'être mis à la valeur `undefined`.
- `$f`: Fonction neutre ou de mise à jour, qui n'a pas d'impact direct sur la valeur.
Ex. neutre : envoi de mail, log. Ex. de mise à jour : changement d'une valeur sur le parent.
- `$$v`: comme $v, en asynchrone. L'erreur ne peut alors plus être `throw`, elle doit être renvoyée en premier argument.
- `$$u`: comme $u, en asynchrone.
- `$$f`: comme $f, en asynchrone.
- `$if`: Fonction utilisée pour déterminer si l'on doit exécuter le processus en question. Même fonctionnement que le $if des normes.
- `flags`: Flags du processus. Non utilisés pour l'instant.
- `[arguments du processus]`: Tout argument à passer au processus, récupéré sur `this`.

Si une `string` est fournie en tant que processus, celle-ci représente son type.

### Processi par défaut

Les champs `default`/`$default` & `fields` d'une norme sont transformés par défault en deux processi spécifiques pour qu'ils puissent être pris en compte. S'ils sont présents, ils seront automatiquement ajoutés aux processi de la norme, au début, dans l'ordre suivant :
```
{$p: ["myProcess"]}

// $p = ["default", "fields", "myProcess"]
```

Il est possible de modifier l'ordre d'apparition de ces processi, en les ajoutant manuellement dans $p. Dans l'exemple :
```
{$p: ["myProcess", "fields"]}

// $p = ["default", "myProcess", "fields"]
```

### Arguments

Les arguments des fonctions sychrones (`$v`/`$u`/`$f`) des processi commencent par la valeur de l'enfant traité dans la norme du processus en question, puis remontent jusqu'à l'objet normalisé en premier lieu.
Si un tableau se présente dans la remontée, l'élément du tableau puis le tableau lui-même se suivent dans les arguments. Exemple : `{$u: function(riderName, rider, riders, horse) { ... }}`.

Les arguments des fonctions asynchrones (`$$v`/`$$u`/`$$f`) des processi fonctionnent de la même façon, ) la différence que le dernier argument utilisé se trouve être le callback. Exemple :
```
// toutes ces normes fonctionnent pareillement :

{$u: function(callback) { ... }}
{$u: function(riderName, callback) { ... }}
{$u: function(riderName, rider, callback) { ... }}
{$u: function(riderName, rider, riders, callback) { ... }}
{$u: function(riderName, rider, riders, horse, callback) { ... }}
```

## Options

Aucun champ n'est obligatoire :
- `default`: Défaut : `true`. Si les défauts (`default` & `$default`) doivent être utilisés.
- `$p`. Défaut : `true`. Si les processi (`$p`) doivent être utilisés.
- `$v`. Défaut : `true`. Si les processi (`$v` & `$$v`) doivent être utilisés.
- `$u`. Défaut : `true`. Si les processi (`$u` & `$$u`) doivent être utilisés.
- `$f`. Défaut : `true`. Si les processi (`$f` & `$$f`) doivent être utilisés.
- `verbose`. Défaut : `false`. Non utilisé, non fonctionnel.
- `forceEdit`. Défaut : `false`. Force l'écriture d'un objet lorsque le path est multiple. Ex. :
```
const horses = [{}];
dd.normalize(horses, {path: "rider.name", default: null}, {forceEdit: true});
console.log(horses);
// [{
//     rider: {name: null}
// }]
```

- `flags`: Les flags à utiliser. Non utilisés pour l'instant.
- `noCycle`. Défaut : `true`.
Vérification que la norme et ses enfants ne passent pas deux fois par le même élément. Tout passage sur le même élément est ignoré.
Les éléments en question peuvent être des `PlainObject` ou des `Array`. Ex. :
```
const horsePocoto = {};
const horses = [horsePocoto, horsePocoto];

const horseNorm = {fields: [
    {path: "name", default: "Pocoto"},
    {path: "id", default: 1, $p: [{$u: function(id) {
        return id +1;
    }}]}
]};

dd.normalize(horses, horseNorm);


console.log(horses);
// [
//     {name: "Pocoto", id: 1},
//     {name: "Pocoto", id: 1}
// ];
```

- `fieldPath`: Liste de de strings. Permet de filtrer les normes enfant avec des chemins.
Si fieldPath n'est pas vide, toute norme avec un chemin non présent dans fieldPath est ignoré. Ex. :
```
const horseNorm = {fields: [
    {path: "name", default: "Pocoto"},
    {path: "id", default: 1}
]};

const horses = [
    {name: "Poupoune"}
];

dd.normalize(horses, horseNorm, {fieldPath: ["name"]});


console.log(horses);
// [
//     {name: "Poupoune"}
// ];
```

## Proccesses classiques

### norm
*$u*.
Normalise la valeur avec la norme `this.object`.
- `object`: Obligatoire. La norme servant à la normalisation.
- `optionsF`: fonction renvoyant les options fournies à la normalisation. Les options seront : `_.defaults({}, this.optionsF.call(this, value), this.options, defaultOptions)`.

Les options, l'asynchronisme et la chaîne des arguments sont conservés lors de l'opération.

### required
*$v*.
Vérifie que la valeur est `defined`.

### log
*$f*.
Loggue le champ et sa valeur.

## Bonnes pratiques & dangers


### Parallélisme

Les `path` des normes enfants n'ont absolument pas vocation à être unique. Cependant, il est une bonne pratique de les factoriser au maximum.
Ainsi, utiliser plusieurs fois le même chemin fera souvent apparaître une nécessité d'avoir exécuté l'intégralité de la norme précédente.

Prenons l'exemple suivant :

************************************* wip from here. Don't read.
```
const wrongHorseNorm = {fields: [
    {path: "id", default: 0},
    {path: "childName", $default: function(horse, horses) {
        const child = _.find(horses, {parentId: horse.id});
        return child ? child.name : null;
    }}
]};

const goodHorseNorm = {fields: [
    {path: "id", default: 0}
    
    {path: "childName", $default: function(horse, horses) {
        const child = _.find(horses, {parentId: horse.id});
        return child ? child.name : null;
    }}
]};

const horses = [
    {id:3, name: "Pocoto", parentId: 0},
    {name: "Poupoune", parentId: 3}
];

const wrongHorses = dd.normalize(_.cloneDeep(horses), wrongHorseNorm);
const goodHorses = dd.normalize(_.cloneDeep(horses), goodHorseNorm);


console.log(wrongHorses);
// [
//     {id:3, name: "Pocoto", parentId: 0, childName: null},
//     {id: 0, name: "Poupoune", parentId: 3, childName: "Pocoto"}
// ];

console.log(goodHorses);
// [
//     {id:3, name: "Pocoto", parentId: 0, childName: "Poupoune"},
//     {id: 0, name: "Poupoune", parentId: 3, childName: "Pocoto"}
// ];
```