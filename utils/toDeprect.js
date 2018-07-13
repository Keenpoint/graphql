const _ = require("lodash");
const async = require("async");

const pathRegexp = /(.+?)[.]/;

const getNextKV = function(object, path) {
    const kv = {k: null, v: null};

    const match = pathRegexp.exec(path);

    if(match)
    {
        kv.k = path.replace(pathRegexp, "");
        kv.pk = match[1];
        kv.v = object[match[1]];
    }
    else {
        kv.v = object[path];
    }
    return kv;
};

const goTo = function(object, path) {
    if(! _.isString(path)) throw new Error("Path doit être une string");

    let r;

    if(_.isPlainObject(object)) {
        let newPath = path;
        let path2;
        let match;
        let o;
        do {
            match = pathRegexp.exec(newPath);
            newPath = newPath.replace(pathRegexp, "");

            if(match) {
                path2 = (path2 ? path2 + "." : "") + match[1];
                o = object[path2];

                if(o !== undefined) {
                    r = goTo(o, newPath);
                }
            }
            else {
                r = object[path];
            }
        }
        while(match && o === undefined);
    }

    return r;
};

const goToAll = function(object, path) {
    const r = [];

    if(!path) {
        r.push(object);
    }
    else if(_.isPlainObject(object)) {
        const kv = getNextKV(object, path);
        r.push(...goToAll(kv.v, kv.k));
    }
    else if(_.isArray(object)) {
        object.forEach(function(subObject) {
            const subR = goToAll(subObject, path);
            r.push(...subR);
        });
    }

    return r;
};

const forceMap = function(value, execute, forceArrayOutput) {
    if(! execute) execute = _.identity;
    return _.isArray(value)
        ? _.map(value, execute)
        : forceArrayOutput ? [execute(value)] : execute(value);
};

const forceMapSeries = function(value, execute) {
    const callback = _.last(arguments);
    let forceArrayOutput;
    if(arguments.length >= 4) forceArrayOutput = arguments[2];
    if(_.isArray(value)) return async.mapSeries(value, execute, callback);
    else if(forceArrayOutput) execute(value, function(e, answer) { callback(e, [answer]); });
    else execute(value, callback);
};

const filterFields = function(object, paths) {

    if(_.isArray(object)) {
        return object.map(function(object) {
            return filterFields(object, paths);
        });
    }

    if(! _.isPlainObject(object)) return object;

    const newObject = {};
    const childrenFields = {};
    paths.forEach(function(path) {
        const childMatch = pathRegexp.exec(path);
        if(childMatch) {
            const parentPath = childMatch[1];
            if(! childrenFields[parentPath]) childrenFields[parentPath] = [];
            childrenFields[parentPath].push(path.replace(pathRegexp, ""));
        }
        else if(! _.isUndefined(object[path])) newObject[path] = _.clone(object[path]);

    });

    _.forIn(childrenFields, function(value, key) {
        if(! _.isUndefined(object[key])) newObject[key] = filterFields(object[key], value);
    });

    return newObject;
};

module.exports = {
    filterFields,
    forceMap,
    forceMapSeries,
    goTo,
    goToAll
};