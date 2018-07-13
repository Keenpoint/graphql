var _ = require("lodash");

var isEmpty = function(value) {
    return (_.isUndefined(value) || value === null || ((_.isString(value) || _.isObject(value)) && _.isEmpty(value)));
};

var types = [
    {
        type: "object",
        default: null
    },
    {
        type: "string",
        default: "",
        convert: function(o) { return o.toString(); }
    },
    {
        type: "integer",
        default: null,
        convert: function(o) { return parseInt(o); }
    },
    {
        type: "decimal",
        default: null,
        convert: function(o) { return parseFloat(o); }
    },
    {
        type: "boolean",
        default: null,
        convert: function(o) { return o.toString() === "true"; }
    },
    {
        type: "date",
        default: null,
        convert: function(o) { return new Date(o.toString()); }
    }
];

module.exports = types.map(function(type) {
    var name = "to" + type.type.charAt(0).toUpperCase() + type.type.slice(1);

    var $u = function(value) {
        if(isEmpty(value)) return this.list ? [] : type.default;

        try {
            var convert = type.convert || _.identity;
            if(_.isArray(value) && this.list) value = value.map(convert);
            else value = this.list ? [convert(value)] : convert(value);
        } catch(e) {
            if(! this.log) return e;
            console.log(e);
        }

        return value;
    };

    return {type: name, $u: $u};
});