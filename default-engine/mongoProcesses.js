const {ObjectID} = require("mongodb");
const async = require("async");
const {manageNotFound, manageEmptyInArray} = require("./../utils/Errors");
const MongoCache = require("../utils/mongoCache");
const {getNextSequence} = require("../utils/mongoUtils");
const {forceMap, forceMapSeries} = require('../utils/toDeprect');
const {forceArray} = require('../utils/functional');
const _ = require("lodash");

const asyncCompact = (value, callback) => {
    if(_.isArray(value)) value = _.compact(value);
    callback(null, value);
};

const getNewId = () => new ObjectID().toString();

const getObjectFromTingoId = entity => (id, callback) => {
    if(!id)
        return callback(null, null);

    // Sometimes, by magic, the object has already been recovered!
    if(_.isObject(id) && (id._bsontype !== "ObjectID"))
        return callback(null, id);

    const collectionName = entity.collectionName;

    mdb.collection(collectionName).findOne({_id: id}, callback);
};

function translateFieldNames(paths, entity, context) {
    return paths.map(path => {
        const field = entity.fields.find(field => field.path === path)

        return field && (field.tKey && context.tc(field.tKey))
    })
}

const processes = [
    {type: "IdOnParentToObject", $$u: function(value, callback) {
        const mc = MongoCache.getFromNormOptions(this.options);
        const entity = this.entity;
        const ignoreNotFound = this.ignoreNotFound;

        async.waterfall([
            callback => callback(null, value),

            async.asyncify(manageEmptyInArray({entity, objectType: "Static ID"})),

            (value, callback) => forceMapSeries(value, (_id, callback) => {
                if(!ObjectID.isValid(_id)) return callback(null, _id);
                const id = _id.toString();

                async.waterfall([
                    callback => mc.get(entity, id, null, callback),
                    (object, callback) => {
                        if(object){
                            mc.add(entity.collectionName, object, null);
                        }
                        callback(null, object)
                    },
                    manageNotFound(ignoreNotFound, {entity, id})
                ], callback);
            }, callback),

            asyncCompact

        ], callback);
    }},
    {type: "StaticIdOnParentToObject", $$u: function(value, callback) {
        const entity = this.entity;
        const ignoreNotFound = this.ignoreNotFound;

        async.waterfall([
            callback => callback(null, value),
            async.asyncify(manageEmptyInArray({entity, objectType: "ObjectID"})),
            (value, callback) => forceMapSeries(value, (id, callback) => {
                if(_.isUndefined(id) || _.isNull(id)) return callback(null, id);

                async.waterfall([
                    callback => entity.db.getDBObject(id, {}, callback),
                    manageNotFound(ignoreNotFound, {entity, id})
                ], callback);
            }, callback),
            asyncCompact
        ], callback);
    }},
    {type: "TingoIdOnParentToObject", $$u: function(value, callback) {
        const entity = this.entity;
        const ignoreNotFound = this.ignoreNotFound;

        async.waterfall([
            callback => callback(null, value),
            async.asyncify(manageEmptyInArray({entity, objectType: "Tingo Refs"})),
            (value, callback) => forceMapSeries(value, (id, callback) => {
                if(_.isUndefined(id) || _.isNull(id)) return callback(null, id);

                async.waterfall([
                    callback => callback(null, id),
                    getObjectFromTingoId(entity),
                    manageNotFound(ignoreNotFound, {entity, id})
                ], callback);
            }, callback),
            asyncCompact
        ], callback);
    }},
    {type: "IdOnChildToObject", $$u: function(value, parentValue, callback) {
            if(value) return callback(null, value);

            const mc = MongoCache.getFromNormOptions(this.options);

            const childCollectionName = this.childCollectionName;
            const parentPathInChild = this.parentPathInChild;
            const multipleChildren = this.multipleChildren;

            //KLUDGE
            // because retro-internal link can't be solved
            if(! childCollectionName) return callback();

            const collection = db.collection(childCollectionName);
            collection.find({
                [parentPathInChild]: this.entity.db.objectToRefId(parentValue)
            }).toArray((e, children) => {
                if (e) return callback(e);

                const realChildren = children.map(
                    child => mc.getOrAdd(childCollectionName, child._id.toString(), null, child)
                );

                callback(null, multipleChildren ? realChildren : realChildren[0] || null);
            });
        }},

    // Unicity validator
    {type: "mongoUnique", $$v: function(value, parentValue, callback) {
        const entity = this.entity;
        const context = this.options.context;
        const collection = entity.collection;
        const field = this.field;

        const uniquePaths = forceArray(this.uniqueWith);

        const parentId = parentValue._id
            || (parentValue.id && (ObjectID.isValid(parentValue.id) ? new ObjectID(parentValue.id) : parentValue.id));

        const uniqueFilters = _(uniquePaths)
            .map(path => {
                const fieldValue = parentValue[path];

                if (!_.isObject(fieldValue)) return {[path]: fieldValue};
                else if (fieldValue.id) return {[path]: new ObjectID(fieldValue.id)};
            })
            .compact()
            .value();

        // KLUDGE if registering parent object, uniqueWith element may have no id, so we skip the query
        if (uniquePaths.length && uniquePaths.length !== uniqueFilters.length) return callback();

        // create the query, mutating the initial query object
        const query = { [field]: value.id ? new ObjectID(value.id) : value };
        if (parentId) query._id = {$ne: parentId};
        if (this.entity.noGroup) query.group = new ObjectID(_.get(context, "group.id"));
        uniqueFilters.reduce((acc, f) => Object.assign(acc, f), query);

        collection.findOne(query, (e, doc) => {
            if (e) return callback(e);
            if (doc) {
                const fieldNames = translateFieldNames([field, ...uniquePaths], entity, context).join(", ");
                return callback(new Error(context.tc("fieldsMustBeUnique", {fieldNames})));
            }
            callback();
        });
    }},

    {type: "createId", $u: function(value) {
        return forceMap(value, id => id || getNewId());
    }},

    {type: "mongoIdToId", $u: function(value, parent) {
        const type = this.idType || "id";

        if(parent._id) {
            const valueM = parent._id;
            delete parent._id;

            switch(type) {
                case "id":
                    value = valueM.toString();
                    break;
                case "integer":
                    value = parseInt(valueM);
                    break;
                case "string":
                    value = valueM;
                    break;

                default:
                    throw new Error("wrong id type: " + type);
            }
        }
        return value;
    }},

    {type: "nextSequence", $$u: function(code, callback) {
        if (!code) {
            getNextSequence(this.sequenceId, (e, sequence) => {
                if (e) throw e;
                const formatResult = this.formatResult || function (result) { return result };
                return callback(null, formatResult(sequence));
            });
        } else {
            return callback(null, code);
        }
    }}
];

module.exports = processes;