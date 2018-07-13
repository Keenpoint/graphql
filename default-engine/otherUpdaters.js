const _ = require("lodash");
const { forceMap } = require("../utils/toDeprect");
const {filterFields} = require("../utils/toDeprect");

module.exports = [
    {type: "filterFields", $u: function(value) {
        const fields = _.isFunction(this.fields) ? this.fields.call(this, value) : this.fields;

        if(! fields) console.warn("no fields provided to filterFields, no filtering applied");

        return filterFields(value, fields);
    }},
    {type: "filterFieldsByNorm", $u: function(value) {
        const fields = _(this.norm.fields)
            .map("path")
            .uniq()
            .value();

        return filterFields(value, fields);
    }},
    {type: "forceArray", $u: function(value) {
        if(_.isUndefined(value)) value = [];
        else if(! _.isArray(value)) value = [value];

        return value;
    }},
    {type: "keyToObject", $u: function(valueOrArray) {
        const key = this.key || "name";

        return forceMap(valueOrArray, function(value) {
            if(_.isString(value)) {
                const object = {};
                object[key] = value;
                value = object;
            }
            return value;
        });
    }},
    {type: "fusion", $u: function(objectOrArray) {
        const objectList = this.list;
        const idName = this.id || "id";

        return forceMap(objectOrArray, function(objectToMerge) {
            if(_.isPlainObject(objectToMerge)) {
                const id = objectToMerge[idName];
                if (! _.isUndefined(id)) {
                    const finder = {[idName]: id};

                    const objectFound = _.find(objectList, finder);
                    if(! objectFound) throw new Error(`Object with ${idName} = ${id} not found`);

                    _.defaultsDeep(objectToMerge, objectFound);//TODO: option to not do clone
                }
            }

            return objectToMerge;
        });
    }},

    {type: "addParentLinkOnChildren", $u: function(value, parentValue) {
        const multipleParents = this.multipleParents;
        const parentPathOnChild = this.parentPathOnChild;

        if(value !== undefined && value !== null && value !== []) {
            const addParent = value => {
                if (multipleParents) {
                    value[parentPathOnChild] = _.remove(
                        value[parentPathOnChild],
                        obj => obj.id !== parentValue.id
                    );
                    value[parentPathOnChild].push(parentValue);
                }
                else value[parentPathOnChild] = parentValue;
            };
            forceMap(value, addParent);
        }
        return value;
    }},

    {type: "bind", $f: function(f, object) {
        if(_.isFunction(f)) f.bind(object);
    }}
];