const connectDataBase = require("./db.js");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const { makeExecutableSchema } = require("graphql-tools");
const { graphqlExpress, graphiqlExpress } = require("apollo-server-express");
const app = express();


// const _ = require("lodash")
// const {normSchema,normResolver} = require("./norme.js")
// const variable = require("./variable.js")
// const dd = require(__dirname + "/default-engine/engine.js");
//
//
// const jobResolver = dd.normalize(variable.entities[0], normResolver);
// const companyResolver = dd.normalize(variable.entities[1], normResolver);
// const queryResolver = dd.normalize(variable.entities[3], normResolver);
// const mutationResolver = dd.normalize(variable.entities[4], normResolver);
//
// const resolvers = {
//     Query: queryResolver.rf,
//     Mutation: mutationResolver.rf,
//     Job: jobResolver.srf,
//     Company: companyResolver.srf
// };
// const schema1 = dd.normalize(variable.entities, normSchema);
// // console.log(schema1)

const run  = async (typeDefs,resolvers) => {

    const Mongo = await connectDataBase();
    global.db = Mongo.db;
    const port = 3000;
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    app.use(cors(), bodyParser.json());
    app.use("/graphql", graphqlExpress({ schema }));
    app.use("/graphiql", graphiqlExpress({ endpointURL: "/graphql" }));
    app.listen(port, () => console.info(`Server started on port ${port}`));
}

// run(schema1,resolvers);
module.exports = {run, app, connectDataBase}