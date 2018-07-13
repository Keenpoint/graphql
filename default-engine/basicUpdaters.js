const _ = require("lodash");
const moment = require("moment");

module.exports = [
    {type: "remove", $u: _.constant()},
    {type: "clone", $u: function(object) { return _.clone(object); }},
    {type: "cloneDeep", $u: function(object) { return _.cloneDeep(object); }},

    {type: "trim", $u: function(value) { return _.isString(value) ? _.trim(value) : value; }},

    {type: "dateToString", pattern: "YYYY-MM-DD", $u: function(value) { const m = moment(value); return m.isValid() ? m.format(this.pattern) : value}},
    {type: "stringToDate", pattern: "YYYY-MM-DD", $u: function(value) { return moment(value, this.pattern).isValid() ? moment(value, this.pattern).toDate() : value}},
    {type: "dateRangeToString", pattern: "YYYY-MM-DD", $u: function(dr) {
        return dr ? dr.map(date => moment(date).format(this.pattern)) : dr;
    }},
    {type: "stringToDateRange", pattern: "YYYY-MM-DD", $u: function(value) {
        return value ? value.map(dateS => moment(dateS, this.pattern).toDate()) : value;
    }},

    {type: "stringToBoolean", $u: function (value) {
        if (_.isString(value)) value = (value === "true");
        return value;
    }},
    {type: "booleanToString", $u: function (value) {
        if (_.isBoolean(value)) value = value ? "true" : "false";
        return value;
    }},

    {type: "stringToJSON", $u: function(value) {
        if (_.isString(value) && (! _.isEmpty(value))) value = JSON.parse(value);
        return value;
    }},
    {type: "JSONToString", $u: function(value) {
        if(_.isPlainObject(value) || _.isArray(value)) value = JSON.stringify(value, null, 4);
        return value;
    }},

    {type: "toArray", $u: function(value) {
        return (_.isArray(value) && ! this.force) ? value : [value];
    }},

    {type: "getter", $f: function(value, object) {
        const getter = this.getter;
        const setter = this.setter;
        const key = this.norm.path;

        if(! _.isUndefined(object[key])) {
            // console.warn("replacing old value by getter. Old value: " + object[key]);
            delete object[key];
        }

        if(getter) object.__defineGetter__(key, getter);
        if(setter) object.__defineSetter__(key, setter);
    }}
];