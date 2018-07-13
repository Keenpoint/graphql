const _ = require("lodash");
const { goToAll } = require("../utils/toDeprect");
const { isMongoField } = require("../utils/mongoUtils");
const { isEmpty } = require("../utils/functional");


const defaultTranslation = {
    t: path => path,
    tc: path => _.upperFirst(path)
}

const translation = (context={}) => ({
    t: context.t || defaultTranslation.t,
    tc: context.tc || defaultTranslation.tc,
})

const getFieldName = o => {
    const field = o.field || {path: o.norm.path};
    return translation(o.options.context).tc(field.path);
};

module.exports = [
    {
        type: "notEmpty",
        $v: function(value) {
            if(isEmpty(value)) {
                return `The field ${this.norm.path} cannot be empty`;
            }
        }
    },

    {
        type: "notNull",
        $v: function(value) {
            if(_.isNull(value)) {
                const fieldName = getFieldName(this);
                const entity = this.entity && {path: _.lowerFirst(this.entity.name)};
                const entityName = translation(this.options.context).tc(entity.path);
                return new Error(translation(this.options.context).tc("fieldCannotBeNull", {fieldName}, {entityName}));
            }
        }
    },

    {
        type: "mongoFieldName",
        $v: function(value) {
            if (!isMongoField(value)) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("mongoFieldName", {fieldName}, {value}));
            }
        }
    },

    {
        type: "technicalName",
        regexTech: /^[1-9A-Za-z_]\w*$/,
        $v: function(value) {
            if(! this.regexTech.test(value)) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("technicalName", {fieldName}, {value}));
            }
        }
    },

    {
        type: "string",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isString(value))) {
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeString", {fieldName}, {type}));
            }
        }
    },

    {
        type: "notNegative",
        $v: function(value) {
            if((_.isUndefined(value) || !Number.isNaN(value)) && value < 0) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("fieldCanNotBeNegative", {fieldName}, {value}));
            }
        }
    },

    {
        type: "object",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isObject(value) || _.isNull(value))) {
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeAnObject", {fieldName}, {type}));
            }
        }
    },

    {
        type: "number",
        $v: function(value) {
            if(! (_.isUndefined(value) || !Number.isNaN(value))) {
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeNumber", {fieldName}, {type}));
            }
        }
    },

    {
        type: "boolean",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isBoolean(value))) {
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeBoolean", {fieldName}, {type}));
            }
        }
    },

    {
        type: "function",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isFunction(value))) {
                console.log(value);
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeFunction", {fieldName}, {type}));
            }
        }
    },

    {
        type: "stringOrFunction",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isString(value) || _.isFunction(value))) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("fieldMustBeStringOrFunction", {fieldName}, {value}));
            }
        }
    },

    {
        type: "stringOrBoolean",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isString(value) || _.isBoolean(value))) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("fieldMustBeStringOrBoolean", {fieldName}, {value}));
            }
        }
    },

    {
        type: "booleanOrFunction",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isBoolean(value) || _.isFunction(value))) {
                const fieldName = getFieldName(this);
                return new Error(translation(this.options.context).tc("fieldMustBeBooleanOrFunction", {fieldName}, {value}));
            }
        }
    },

    {
        type: "enum",
        $v: function(value) { if(! (_.isUndefined(value) || _.isNull(value) || _.includes(this.list, value))) {
            const fieldName = getFieldName(this);
            return new Error(translation(this.options.context).tc("theValueMustBeOnTheList", {fieldName}, {list: this.list}, {value}));
        }}},

    {
        type: "array",
        $v: function(value) {
            if(! (_.isUndefined(value) || _.isArray(value) || _.isNull(value))) {
                const fieldName = getFieldName(this);
                const type = (typeof value);
                return new Error(translation(this.options.context).tc("fieldMustBeAnArray", {fieldName}, {type}));
            }
        }
    },

    {
        type: "unique",
        $v: function(value) {
            if(_.isUndefined(value)) return;
            if(! this.norm.parentNorm) new Error("Pas de norme parente!");
            const path = this.norm.path;

            let n = path.split(".").length+1;
            let times = 0;

            for(let j = 1; j<n; j++) if(_.isArray(arguments[j])) n++;

            const list = goToAll(arguments[n], path);

            list.forEach(val => {
                if(_.isEqual(val, value)) times++;
            });

            if(times>=2) {
                const fieldName = getFieldName(this);
                return new Error(this.options.context.tc("fieldMustBeUniqueOnArray", {fieldName}, {value}));
            }
        }
    }
];