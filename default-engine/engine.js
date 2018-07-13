const _ = require("lodash");
const { nextTick, series: asyncSeries } = require("async");
const { goTo } = require("../utils/toDeprect");
const pathRegexp = /(.+?)[.]/;

const getNextKV = (object, path) => {
    const kv = {k: null, v: null};

    const match = pathRegexp.exec(path);

    if(match) {
        kv.k = path.replace(pathRegexp, "");
        kv.pk = match[1];
        kv.v = object[match[1]];
    }
    else {
        kv.v = object[path];
    }
    return kv;
};

const syncSeries = fs => {
    let e = undefined;
    fs.some(f => e = f());
    return e;
};

const series = (fs, callback) => callback ? asyncSeries(fs, callback) : syncSeries(fs);

const updateChain = (chain, newKey) => {
    if(! chain) chain = [];
    return [newKey].concat(chain);
};

const cloneNorm = norm => {
    const n = _.clone(norm);
    n.originalNorm = norm.originalNorm || norm;
    return n;
};

const getNoCycleConf = options => {
    if(options.noCycle) {
        if(options.noCycle === true) options.noCycle = new WeakMap();
        return options.noCycle;
    }
};

const notInCycle = (object, norm, noCycleConf) => {
    if(_.isPlainObject(object) || _.isArray(object)) {
        norm = norm.originalNorm || norm;
        const objectConf = noCycleConf.get(object);
        if(! objectConf) {
            noCycleConf.set(object, new WeakSet().add(norm));
        }
        else {
            const hasNorm = objectConf.has(norm);
            if(! hasNorm) objectConf.add(norm);
            else {
                // console.log("cycle");
                return false;
            }
        }
    }

    if(_.isArray(object) && ! _.isEmpty(object)) {
        return _.some(object.map(subObject => notInCycle(subObject, norm, noCycleConf)));
    }
    return true;
};

const solveCycle = (object, norm, options) => {
    const noCycleConf = options && getNoCycleConf(options);
    return (! noCycleConf) || notInCycle(object, norm, noCycleConf);
}

const editAll = function(object, path, value, $value, chain, forceEdit, callback) {
    if(! $value) $value = (editValue, value, subChain, callback) => {
        editValue(value);
        if(callback) callback();
    };

    chain = updateChain(chain, object);

    if(_.isPlainObject(object)) {
        const kv = getNextKV(object, path);

        if(kv.k) {
            if(forceEdit && (! (_.isPlainObject(kv.v) || _.isArray(kv.v)))) kv.v = object[kv.pk] = {};

            if(_.isPlainObject(kv.v) || _.isArray(kv.v)) return editAll(kv.v, kv.k, null, $value, chain, forceEdit, callback);
        }
        else {
            const editValue = function(newValue) {
                if(! object.__lookupGetter__(path)) {
                    if(_.isUndefined(newValue)) delete object[path];
                    else return object[path] = newValue;
                }
            };

            return $value(editValue, object[path], chain, callback);
        }
    }
    else if(_.isArray(object)) {
        const edits = object.map(o => callback => editAll(o, path, null, $value, chain, forceEdit, callback));

        return series(edits, callback);
    }

    if(callback) callback();
};

const containsAll = (collection, targets) => _.every(targets, target => _.includes(collection, target));

const backRegex = new RegExp("^[.][.]/");

const resolveChainValue = function(chain, path) {
    let value;

    if(backRegex.exec(path)) {
        path = path.replace(backRegex, "");
        chain = chain.slice(0);
        chain.splice(0, 1);
        value = resolveChainValue(chain, path);
    }
    else {
        const object = chain[0];
//        if(!_.isPlainObject(object)) throw new Error("Not plain object");
        value = (path === "") ? object : goTo(object, path);
    }
    return value;
};

const resolvePath = function(chain, path) {
    if(_.isFunction(path)) return path.apply(this, chain);
    else return resolveChainValue(chain, path);
};

const validatePath = function(chain, path) {
    if(_.isPlainObject(path)) return _.every(path, (value, key) => resolvePath(chain, key) === value);
    else if(_.isFunction(path)) return path.apply(this, chain);
    else return resolvePath(chain, path);
};

const solveFlag = function(norm, options) {
    let enter = true;
    const flags = options.flag ? [options.flag] : options.flags;

    if(flags && (! containsAll(options.flags, norm.flags))) enter = false;

    return enter;
};

const solveIf = function(norm, chain) {
    return norm.$if ? validatePath.call(norm, chain, norm.$if) : true;
};

const needDefault = function(options, value, actionValue) {
    return options.default
        && (
            actionValue ||
            _.isUndefined(value)
        );
};

const defaultProcessFunction = function() {
    const norm = this.norm;
    const chain = _.toArray(arguments);
    let value = chain[0];

    let actionValue;
    if(_.isObject(value) && (value.$push || value.$pushAll || value.$addToSet || value.$set)) actionValue = value;

    let chainR2 = undefined;

    // set default if needed
    if(needDefault(this.options, value, actionValue)) {
        if(norm.$default) {
            chainR2 = chain.slice(1);
            if(_.isFunction(norm.$default)) value = norm.$default.apply(this, chainR2);
            else if(_.isString(norm.$default)) value = resolveChainValue(chainR2, norm.$default);
        }
        else {
            value = _.isFunction(norm.default) ? norm.default : _.clone(norm.default)
        }
    }

    // run action like $push
    if(actionValue) {
        if(actionValue.$push) {
            value.push(actionValue.$push);
        }
        else if(actionValue.$pushAll) {
            actionValue.$pushAll.forEach(object => value.push(object));
        }
        else if(actionValue.$addToSet) {
            if(! _.includes(value, actionValue.$addToSet)) value.push(actionValue.$addToSet);
        }
        if(actionValue.$set) {
            const $set = actionValue.$set;
            if(_.isFunction($set)) value = $set.apply(norm, chainR2);
            else if(_.isString($set)) value = resolveChainValue(chainR2, $set);
        }
    }
    return value;
};

const isPathInFieldPath = (path, fieldPath) => {
    const pathPrefix = path + ".";
    return fieldPath.some(p => p === path || pathPrefix === p.slice(0, pathPrefix.length));
};

const filterFields = (fields, fieldPath) => fields.filter(field => isPathInFieldPath(field.path, fieldPath));

const getChildFieldPath = function(fieldPath, childPath) {
    const childPathPrefix = childPath + ".";
    return _(fieldPath)
        .filter(path => childPathPrefix === path.slice(0, childPathPrefix.length))
        .map(path => path.slice(childPathPrefix.length))
        .compact()
        .value()
        || undefined;
};

const fieldsEditFunction = function(isAsync) {
    return function() {
        const chain = _.toArray(arguments);
        const object = chain.shift();
        const callback = isAsync ? chain.pop() : null;

        const parentNorm = this.norm;
        const fields = parentNorm.fields || [];

        const options = this.options;
        const fieldPath = options && options.fieldPath;

        const filteredFields = _.isEmpty(fieldPath) ? fields : filterFields(fields, fieldPath);

        const fieldEdit = function (norm, childOptions, callback) {
            norm.parentNorm = parentNorm;

            return editAll(object, norm.path, null, function (editValue, value, chain, callback) {
                let callback2;
                if (callback) callback2 = function (e, object) {
                    if (!e) editValue(object);
                    nextTick(() => callback(e, object));
                };

                const back = defaultizeInternal(value, norm, childOptions, chain, callback2);
                if(! _.isUndefined(back)) {
                    if (back instanceof Error) return back;
                    editValue(back);
                }

            }, chain, options.forceEdit, callback);
        };

        const fieldsEdits = filteredFields.map(norm => {
            let childOptions;
            if(fieldPath) {
                childOptions = _.clone(options);
                childOptions.fieldPath = getChildFieldPath(fieldPath, norm.path);
            }
            else childOptions = options;

            return callback => fieldEdit(cloneNorm(norm), childOptions, callback);
        });

        return series(fieldsEdits, callback);
    };
};

const normProcessFunction = function(async) {
    return function() {
        const value = arguments[0];
        const norm = this.object instanceof Norm ? this.object : dd(this.object);

        const options = _.defaults({}, this.optionsF && this.optionsF.call(this, value), this.options, defaultOptions);

        const callback = async ? _.last(arguments) : null;

        const args = _.toArray(arguments);
        args.shift();
        return defaultizeInternal(value, norm.norm, options, args, callback);
    };
};

let processes = [
    {type: "default", $u: defaultProcessFunction, force: true},
    {type: "fields", $f: fieldsEditFunction(), $$f: fieldsEditFunction(true), force: true},
    {type: "norm", $u: normProcessFunction(), $$u: normProcessFunction(true)},

    {
        type: "required",
        m: "Le champ <%= normName %> est requis dans l'instance <%= objectName %> de l'objet <%= parentNormName %>",
        $v: function(value, object) {
            if(value === undefined) {
                const normName = this.norm.name || this.norm.path;
                const parentNormName = this.norm.parentNorm ? (this.norm.parentNorm.name || this.norm.parentNorm.path) : "";
                return new Error(_.template(this.m)({normName, objectName: object.name || object.id || object.type, parentNormName}));
            }
        }
    },

    //{type: "log", m: "_____________________________\n<%= path %>: <%= value %>", $f: function(value) { console.log(_.template(this.m)({path: this.norm.path || this.norm.name, value: value})); }}
    {type: "log", m: "_____________________________\n<%= path %>: <%= value %>", $f: function(value) {
        const normNameType = this.norm.name ? "name" : "path";
        const name = this.norm[normNameType];

        console.log("_____________________________");
        console.log(normNameType + ": " + name);
        console.log(value);
    }}
];

let processesByType = _.keyBy(processes, "type");

const Verbose = function(norm, options) {
    this.norm = norm;
    this.options = options;
    this.v = options.verbose;
};

Verbose.prototype.logName = function() {
    if(this.v && this.norm.path) console.log("Norm: " + this.norm.path);
};

Verbose.prototype.logField = function(norm) {
    if(this.v) console.log("Norm: " + norm.path);
};

Verbose.prototype.logProp = function(e, norm, solvedFlag, solvedIf, chain) {
    if(this.v) {
        let s = "Property: [" + norm.path + "]. ";

        if(e) s+= "Evicted because error: " + e;
        else if(! solvedFlag) s+= " No flag.";
        else if(! solvedIf) s+= "if evicted.";
        else {
            s+= "Value: " + chain[0];
//            s+= chain;
        }
        console.log(s);
    }
};

const getCleanProcesses = function(norm) {
    let $p = norm.$p || [];
    if(! _.isArray($p)) $p = [$p];

    $p = $p.map(function(process) {
        if(_.isString(process)) process = {type: process};
        if(_.isFunction(process)) process = {$u: process};
        return process;
    });

    const hasDefaultProcess = $p.some(function(process) { return process.type === "default"; });
    const hasFieldsProcess = $p.some(function(process) { return process.type === "fields"; });

    if(! hasFieldsProcess && ! _.isEmpty(norm.fields)) $p.unshift({type: "fields"});
    if(! hasDefaultProcess && ! (_.isUndefined(norm.default) && _.isUndefined(norm.$default))) $p.unshift({type: "default"});

    return $p;
};

const processFunctionsPriorities = function(async) {
    return async ? ["$$v", "$$f", "$$u", "$v", "$f", "$u"] : ["$v", "$f", "$u", "$$v", "$$f", "$$u"];
};

const runProcesses = function(options, chain, norm, callback) {
    const rp = function() {
        const $p = getCleanProcesses(norm);

        const executePs = $p.map(function(process) {
            return function(callback) {
                if(process.force || (options.$p && ! _.isEmpty($p))) {
                    if(process.type) process = _.defaults(process, processesByType[process.type]);
                    process.norm = norm;
                    process.options = options;

                    const solvedFlag = solveFlag(process, options);
                    const solvedIf = solvedFlag ? solveIf(process, chain) : false;

                    if(solvedFlag && solvedIf) {
                        const functionType = _.find(processFunctionsPriorities(callback), function(functionType) { return process[functionType]; });
                        let basicType, asyncFunction;
                        switch(functionType) {
                            case "$v":
                                basicType = "v";
                                break;

                            case "$u":
                                basicType = "u";
                                break;

                            case "$f":
                                basicType = "f";
                                break;

                            case "$$v":
                                basicType = "v";
                                asyncFunction = true;
                                break;

                            case "$$u":
                                basicType = "u";
                                asyncFunction = true;
                                break;

                            case "$$f":
                                basicType = "f";
                                asyncFunction = true;
                                break;

                            default:
                                break;
                                // console.warn("unknown process " + process.type);
                        }

                        if(functionType && (process.force || options["$" + basicType])) {
                            const f = process[functionType];

                            if(! asyncFunction) {
                                let back, err;

                                // execute sync function
                                if(callback || basicType === "v") {
                                    try {
                                        back = f.apply(process, chain);
                                    } catch(e) {
                                        err = e;
                                    }
                                }
                                else back = f.apply(process, chain);

                                // manage result
                                if(! err) {
                                    if(basicType === "v" && back instanceof Error) err = back;
                                    else if(basicType === "u") chain[0] = back;
                                }

                                // leave if needed
                                if(callback) callback(err);
                                else if(err) throw err;
                            }
                            else {
                                if(! callback) return new Error("Async function called in sync environment");

                                const argLength = f.length;
                                if(argLength > chain.length + 1) console.warn("More arguments in process function than existing. Asked " + argLength + ", existing " + (chain.length + 1) + ".");
                                const args = argLength === 0 ? chain : chain.slice(0, argLength - 1);

                                const callback2 = function(e, value) {

                                    if(e) return callback(e);

                                    if(basicType === "u") chain[0] = value;

                                    callback();
                                };
                                args.push(callback2);

                                f.apply(process, args);
                            }
                        }
                        else if(callback) callback();
                    }
                    else if(callback) callback();
                }
                else if(callback) callback();
            };
        });

        return series(executePs, callback);
    };

    // async1 calls nextTick for up
    // return rp();

    // with async2
    // by the way, read this: http://blog.ometer.com/2011/07/24/callbacks-synchronous-and-asynchronous/
    // and this: http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
    return callback ? nextTick(rp) : rp();
};

const defaultizeInternal = function(object, norm, options, oldChain, callback) {

    let e, callback3;

    if(callback) callback3 = function(err) {
        if(err && !(err instanceof Error)) err = new Error("wrong error");

        callback(err, object);
    };

    //var vb = new Verbose(norm, options);
//        vb.logName();
    const newChain = updateChain(oldChain, object);

    const ifChain = newChain.concat([options]);

    //norm.options = options;
    const solvedFlag = solveFlag(norm, options);
    const solvedIf = solvedFlag ? solveIf(norm, ifChain) : false;
    const solvedCycle = solvedFlag && solvedIf && solveCycle(object, norm, options);

    if(solvedFlag && solvedIf && solvedCycle) {

        const callback_ = function (err) {
            if (!err) object = newChain[0];
            if (callback) callback3(err, object);
            else e = err;
        };

        const err = runProcesses(options, newChain, norm, callback ? callback_ : null);
        if (! callback) callback_(err);
    }
    else if(callback) callback(null, object);

    if(! callback) return (e || object);
};

const defaultOptions = {
    default: true,
    $p: true,
    $v: true,
    $u: true,
    $f: true,
    verbose: false,
    forceEdit: false,
    noCycle: true
};

const defaultize_ = function(object, norm, options, callback) {
    if(! options) options = {};
    const fullOptions = Object.assign({}, defaultOptions, options);
    return defaultizeInternal(object, cloneNorm(norm), fullOptions, [], callback);
};

const Norm = function(norm, options) {
    this.norm = norm;
    this.options = options;
};

Norm.prototype.normalize = function(object, options, callback) {
    return defaultize_(object, this.norm, options, callback);
};

//var dd = {
//    Norm: Norm,
////    defaultize: defaultize,
//    normalize: function(object, norm, options, callback) { return new Norm(norm, options).normalize(object, options, callback); },
////    validate: function(object, convention, callback) {
////        return defaultize(object, convention, {$p: false, default: false}, callback);
////    }
//}

const dd = (norm, options) => new Norm(norm, options);

dd.isPathInFieldPath = isPathInFieldPath;
dd.getChildFieldPath = getChildFieldPath;

dd.normalize = (object, norm, options, callback) => new Norm(norm, options).normalize(object, options, callback);

dd.normalizeAsync = (input, norm, options) => new Promise((resolve, reject) => {
    dd.normalize(input, norm, options, (error, object) => {
        if (error) return reject(error)
        resolve(object)
    })
})

dd.addProcesses = newProcesses => {
    processes = processes.concat(newProcesses);
    processesByType = _.keyBy(processes, "type");
};

dd.normalizeInternal = (object, norm, options, oldChain, callback) => {
    const fullOptions = Object.assign({}, defaultOptions, options);
    return defaultizeInternal(object, cloneNorm(norm), fullOptions, oldChain, callback);
};

module.exports = dd;