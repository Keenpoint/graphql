const {normSchema,normResolver} = require("./norme.js")
const variable = require("./variable.js")
const dd = require(__dirname + "/default-engine/engine.js");
const {run} = require("./server.js");


const jobResolver = dd.normalize(variable.entities[0], normResolver);
const companyResolver = dd.normalize(variable.entities[1], normResolver);
const queryResolver = dd.normalize(variable.entities[3], normResolver);
const mutationResolver = dd.normalize(variable.entities[4], normResolver);

const resolvers = {
    Query: queryResolver.rf,
    Mutation: mutationResolver.rf,
    Job: jobResolver.srf,
    Company: companyResolver.srf
};
const schema1 = dd.normalize(variable.entities, normSchema);

run(schema1,resolvers);