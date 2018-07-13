const _ = require("lodash")
const ObjectID = require("mongodb").ObjectID;

function toString(array) {
    return array.reduce(
        (acc, curr) => {
            acc = acc + `${curr.path} `;
            return acc;
        },
        ""
    );
}

const normSchema = {
    name: "normSchema",
    $p: {
        $u: obj => {
            let Schema = "";
            for (const element of obj) {
                const schema = element.fields.reduce((acc, curr) => {
                    let type = curr.path;
                    let output = curr.type;

                    if (curr.required) {
                        output= `${curr.type}!`
                    }

                    if (curr.link === "OTM" || curr.isArray) {
                        output = `[${curr.type}]`
                    }

                    if (curr.input) {
                        const path = curr.input.map( input => {
                            if (input.required) {
                                input.path = `${input.path}: ${input.type}!`;
                                return input;
                            } else {
                                input.path = `${input.path}: ${input.type}`;
                                return input;
                            }
                        });
                        type = `${curr.path}(${toString(path)})`
                    }
                    acc = acc +`${type}:${output},`
                    return acc;
                }, "");

                let newSchema;
                if(element.type === "normal" || "query" || "mutation" ){
                     newSchema = `type ${element.name} {${schema}}\n`;
                }
                if(element.type === "input"){
                     newSchema = `input ${element.name} {${schema}}\n`;
                }
                Schema = Schema + newSchema;
            }
            return Schema;
        }
    }
};

/*
c'est un norm interpréter le schema,
la premiere partie, qui a un champ "rf" c'est pour in la class query and mutation.
la deuxieme partie, qui a un champ "srf", c'est pour interpreter des variable dans des class
dont le type n'est pas predefini par Graphql.
Des variable ont predefini par Graphql: String,Boolean,ID,Int,Float

* */
const normResolver = {
    name: "normResolver",
    fields: [
        {
            // query resolve function
            path: "rf",
            $default: obj => {
                if (obj.name === "Query") {
                    return obj.fields.reduce(
                        (acc, curr) => {
                            acc = {
                                ...acc,
                                [curr.path]: async function(parent, args) {
                                    args._id
                                        ? (args._id = new ObjectID(args._id))
                                        : {};
                                    try {
                                        const data = await global.db
                                            .collection(`${curr.type}`)
                                            .find(args)
                                            .toArray();
                                        if (curr.isArray) {
                                            return data;
                                        } else {
                                            return data[0];
                                        }
                                    } catch (e) {
                                        console.log(e);
                                    }
                                }
                            };
                            return acc;
                        },
                        {}
                    );
                }
                if(obj.name === "Mutation"){
                    return obj.fields.reduce(
                        (acc, curr) => {
                            if(curr.operation === "delete"){
                                acc = {
                                    ...acc,
                                    [curr.path]: async function(parent,args){
                                        args._id
                                            ? (args._id = new ObjectID(args._id))
                                            : {};
                                        try {
                                            await global.db
                                                .collection(`${curr.type}`)
                                                .removeOne(args);
                                            return await global.db
                                                .collection(`${curr.type}`)
                                                .find({}).toArray();
                                        } catch (e) {
                                            console.log(e);
                                        }
                                    }
                                }
                            }
                            if(curr.operation === "create"){
                                acc = {
                                    ...acc,
                                    [curr.path]: async function(parent,args){
                                        try {
                                            await global.db
                                                .collection(`${curr.type}`)
                                                .insertOne(args.inputCompany);
                                            return await global.db
                                                    .collection(`${curr.type}`)
                                                    .find({}).toArray();

                                        } catch (e) {
                                            console.log(e);
                                        }
                                    }
                                }
                            }
                            if(curr.operation === "update"){
                                acc = {
                                    ...acc,
                                    [curr.path]: async function(parent,args){
                                        args._id
                                            ? (args._id = new ObjectID(args._id))
                                            : {};
                                        try {
                                            await global.db
                                                .collection(`${curr.type}`)
                                                .updateOne({_id: args._id}, {$set:args.inputCompany});
                                            return await global.db
                                                .collection(`${curr.type}`)
                                                .find({}).toArray();
                                        } catch (e) {
                                            console.log(e);
                                        }
                                    }
                                }
                            }
                            return acc;
                        },{}
                    )
                }
            }
        },
        {
            // self resolver fonction, interpreter les proprieties qui n'est pas un scalaire predefinir par la langue
            /*
    form:
    Job {
        company: async function(){}
    }
    * */
            path: "srf",
            $default: obj => {
                return obj.fields.reduce(
                    (acc, curr) => {
                        if (curr.link === "OTO") {
                            acc = {
                                [curr.path]: async parent => {
                                    const data = await global.db
                                        .collection(`${curr.type}`)
                                        .find({ _id: parent[`${curr.path}`] })
                                        .toArray();
                                    return data[0];
                                }
                            };
                            return acc;
                        }
                        if (curr.link === "OTM") {
                            acc = {
                                [curr.path]: async parent => {
                                    return await global.db
                                        .collection(`${curr.type}`)
                                        .find({ [curr.ref]: parent._id })
                                        .toArray();
                                }
                            };
                            return acc;
                        }
                    },
                    {}
                );
            }
        },
    ]
};

module.exports = {normSchema, normResolver}
