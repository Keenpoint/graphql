const connectDataBase = require("./db.js");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const { makeExecutableSchema } = require("graphql-tools");
const { graphqlExpress, graphiqlExpress } = require("apollo-server-express");
const app = express();

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

module.exports = {run, app, connectDataBase}